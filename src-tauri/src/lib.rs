use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(not(debug_assertions))]
use std::fs::File;
#[cfg(not(debug_assertions))]
use std::path::PathBuf;
#[cfg(not(debug_assertions))]
use std::process::Stdio;
#[cfg(not(debug_assertions))]
use std::time::Instant;

/// Holds the Node backend process so we can terminate it when the app exits.
struct ServerProcess(Mutex<Option<Child>>);

/// Injected into the webview: route clicks on external links through a normal
/// navigation (which the navigation handler below opens in the OS browser),
/// so links never hijack the app window. Internal (same-origin) links fall
/// through to the app's own client-side routing.
const LINK_SCRIPT: &str = r#"
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  var href = a.href || '';
  if (/^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0) {
    e.preventDefault();
    window.location.assign(href);
  }
}, true);

// Suppress the WebView's default (browser) context menu — it only offers
// Reload/Back/Inspect, which make no sense in a desktop app.
document.addEventListener('contextmenu', function (e) {
  e.preventDefault();
}, false);
"#;

/// Whether a navigation target is a genuinely external website (as opposed to
/// the app's own pages). The app loads from Tauri's `http://tauri.localhost`
/// asset origin and the backend from `http://127.0.0.1:<port>`, so anything on
/// localhost / *.localhost / 127.0.0.1 must stay inside the window.
fn should_open_externally(s: &str) -> bool {
    let is_web = s.starts_with("http://") || s.starts_with("https://");
    is_web
        && !s.contains("://127.0.0.1")
        && !s.contains("://localhost")
        && !s.contains(".localhost")
}

/// Strip Windows' `\\?\` verbatim prefix — Node's module resolver can't parse
/// it and crashes with `EISDIR: lstat 'C:'`.
#[cfg(not(debug_assertions))]
fn strip_verbatim(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) => PathBuf::from(rest),
        None => p,
    }
}

#[cfg(not(debug_assertions))]
fn find_free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(34567)
}

#[cfg(not(debug_assertions))]
fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

/// Launch the bundled Next.js standalone server via the bundled Node runtime.
/// Data (SQLite DB + uploads) lives in the OS app-data directory.
#[cfg(not(debug_assertions))]
fn start_server(app: &tauri::App, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let resource_dir = strip_verbatim(app.path().resource_dir()?);
    let app_data = strip_verbatim(app.path().app_data_dir()?);
    std::fs::create_dir_all(&app_data)?;

    // First launch: seed the database from the migrated template.
    let db_path = app_data.join("linkstash.db");
    if !db_path.exists() {
        std::fs::copy(resource_dir.join("linkstash-template.db"), &db_path)?;
    }

    let node = resource_dir.join("node.exe");
    let server_dir = resource_dir.join("server");
    let server_js = server_dir.join("server.js");

    // Prisma wants forward slashes in the file: URL, even on Windows.
    let db_url = format!("file:{}", db_path.to_string_lossy().replace('\\', "/"));

    // The GUI app has no console, so the child would inherit invalid stdio
    // handles and crash on its first write. Redirect its output to a log file
    // in app-data (also handy for diagnostics).
    let log = File::create(app_data.join("server.log"))?;
    let log_err = log.try_clone()?;

    let mut cmd = Command::new(node);
    cmd.arg(server_js)
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("LINKSTASH_MODE", "local")
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", port.to_string())
        .env("DATABASE_URL", db_url)
        .env("LINKSTASH_DATA_DIR", app_data.to_string_lossy().to_string())
        // Never used to authenticate in local mode; present so nothing throws.
        .env("SESSION_SECRET", "linkstash-desktop-local-mode")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));

    // Node is a console program; without this flag Windows pops up a terminal
    // window when the GUI app spawns it.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn()?;
    *app.state::<ServerProcess>().0.lock().unwrap() = Some(child);
    Ok(())
}

/// A few seconds after launch, ask GitHub Releases whether a newer version
/// exists. If so, download and install it silently, then relaunch into the new
/// version. Any failure (offline, no release yet, bad signature) is ignored so
/// it never blocks normal use.
#[cfg(all(desktop, not(debug_assertions)))]
fn spawn_update_check(handle: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(5));
        let installed = tauri::async_runtime::block_on(async {
            let update = handle.updater()?.check().await?;
            if let Some(update) = update {
                update.download_and_install(|_, _| {}, || {}).await?;
                return Ok::<bool, tauri_plugin_updater::Error>(true);
            }
            Ok(false)
        });
        if matches!(installed, Ok(true)) {
            handle.restart();
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // Dev loads the running dev server directly; release shows a splash
            // and is redirected to the bundled server once it's ready.
            #[cfg(debug_assertions)]
            let start_url =
                WebviewUrl::External(tauri::Url::parse("http://localhost:3000").unwrap());
            #[cfg(not(debug_assertions))]
            let start_url = WebviewUrl::App("index.html".into());

            let handle = app.handle().clone();
            WebviewWindowBuilder::new(&handle, "main", start_url)
                .title("LinkStash")
                .inner_size(1200.0, 820.0)
                .min_inner_size(720.0, 520.0)
                .center()
                .initialization_script(LINK_SCRIPT)
                .on_navigation(|url| {
                    let s = url.as_str();
                    if should_open_externally(s) {
                        let _ = open::that(s);
                        return false; // keep the app window put
                    }
                    true
                })
                .build()?;

            // In release, boot the bundled server then point the window at it.
            #[cfg(not(debug_assertions))]
            {
                let port = find_free_port();
                start_server(app, port)?;

                let base = format!("http://127.0.0.1:{}", port);
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    wait_for_port(port, Duration::from_secs(90));
                    let base_js = base.clone();
                    let h2 = handle.clone();
                    let _ = handle.run_on_main_thread(move || {
                        if let Some(win) = h2.get_webview_window("main") {
                            let _ = win.eval(
                                format!("window.location.replace('{}')", base_js).as_str(),
                            );
                        }
                    });
                });

                spawn_update_check(app.handle().clone());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Make sure the backend doesn't outlive the app.
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
