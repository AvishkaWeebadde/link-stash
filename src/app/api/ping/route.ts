import { NextResponse } from "next/server";

/**
 * Tiny discovery endpoint. The browser extension probes the app's candidate
 * ports and looks for this {app:"linkstash"} response to find the running
 * instance. CORS-open so the extension (a different origin) can read it.
 */
function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  return res;
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export function GET() {
  return cors(NextResponse.json({ app: "linkstash" }));
}
