import { NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { runSync } from "@/lib/sync";

export async function POST() {
  const { userId } = await requireUser();
  try {
    const stats = await runSync(userId);
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed." },
      { status: 400 },
    );
  }
}
