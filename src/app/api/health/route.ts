import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

export async function GET() {
  return NextResponse.json({ ok: true, integrations: integrationStatus(), time: new Date().toISOString() });
}
