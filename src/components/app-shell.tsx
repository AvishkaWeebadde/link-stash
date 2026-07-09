"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import ThemeToggle from "@/components/theme-toggle";
import { ITEM_TYPE_ICONS } from "@/lib/constants";

type Counts = {
  typeCounts: Record<string, number>;
  unread: number;
  favorite: number;
  total: number;
};

type NamedCount = { id: string; name: string; _count: { items: number } };
type TagCount = NamedCount & { color: string };

export default function AppShell({
  user,
  counts,
  collections,
  tags,
  children,
}: {
  user: { name: string; email: string };
  counts: Counts;
  collections: NamedCount[];
  tags: TagCount[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-2"
        >
          ☰
        </button>
        <span className="font-semibold">📚 LinkStash</span>
        <ThemeToggle />
      </div>

      {/* Backdrop for mobile drawer */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/library" className="font-bold tracking-tight">
            📚 LinkStash
          </Link>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          <Section>
            <NavItem href="/library" label="All items" badge={counts.total} exact />
            <NavItem
              href="/library?status=unread"
              label="Unread"
              badge={counts.unread}
            />
            <NavItem
              href="/library?favorite=1"
              label="Favorites"
              icon="⭐"
              badge={counts.favorite}
            />
          </Section>

          <Section title="Types">
            <NavItem
              href="/library?type=article"
              label="Articles"
              icon={ITEM_TYPE_ICONS.article}
              badge={counts.typeCounts.article ?? 0}
            />
            <NavItem
              href="/library?type=pdf"
              label="PDFs"
              icon={ITEM_TYPE_ICONS.pdf}
              badge={counts.typeCounts.pdf ?? 0}
            />
            <NavItem
              href="/library?type=epub"
              label="Books"
              icon={ITEM_TYPE_ICONS.epub}
              badge={counts.typeCounts.epub ?? 0}
            />
            <NavItem
              href="/library?type=note"
              label="Notes"
              icon={ITEM_TYPE_ICONS.note}
              badge={counts.typeCounts.note ?? 0}
            />
          </Section>

          {collections.length > 0 && (
            <Section title="Collections">
              {collections.map((c) => (
                <NavItem
                  key={c.id}
                  href={`/library?collection=${c.id}`}
                  label={c.name}
                  icon="📁"
                  badge={c._count.items}
                />
              ))}
            </Section>
          )}

          {tags.length > 0 && (
            <Section title="Tags">
              <div className="flex flex-wrap gap-1.5 px-2">
                {tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/library?tag=${t.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted transition hover:border-ring hover:text-fg"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: t.color }}
                    />
                    {t.name}
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                ⎋
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {title && (
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-faint">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  badge,
  exact,
}: {
  href: string;
  label: string;
  icon?: string;
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [path, query] = href.split("?");
  const current = search.toString();

  const active = exact
    ? pathname === path && current === ""
    : pathname === path && query === current;

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-accent-soft font-medium text-fg"
          : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs text-faint">{badge}</span>
      )}
    </Link>
  );
}
