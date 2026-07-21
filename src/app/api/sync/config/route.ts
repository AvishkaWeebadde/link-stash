import { NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { getPublicConfig, updateConfig } from "@/lib/sync";

export async function GET() {
  await requireUser();
  return NextResponse.json(await getPublicConfig());
}

export async function POST(req: Request) {
  await requireUser();
  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    folder?: string;
    passphrase?: string;
  };
  const res = await updateConfig(body);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(await getPublicConfig());
}
