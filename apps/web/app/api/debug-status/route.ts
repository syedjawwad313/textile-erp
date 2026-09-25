import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const cwd = process.cwd();

  const candidatePaths = [
    path.resolve(cwd, "../api/dist/main.js"),
    path.resolve(cwd, "../../apps/api/dist/main.js"),
    path.resolve(cwd, "apps/api/dist/main.js"),
    path.resolve(cwd, "../apps/api/dist/main.js"),
    path.resolve(cwd, "dist/main.js"),
  ];

  const candidatesStatus = candidatePaths.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
  }));

  const internalPort = process.env.INTERNAL_API_PORT || "4001";
  let probeResult: any = "untested";

  try {
    const res = await fetch(`http://127.0.0.1:${internalPort}/ready`, {
      signal: AbortSignal.timeout(1500),
    });
    probeResult = { status: res.status, ok: res.ok };
  } catch (err: any) {
    probeResult = { error: err?.message || String(err) };
  }

  let runtimeLogs = "";
  try {
    const logPath = path.resolve(cwd, "api-runtime.log");
    if (fs.existsSync(logPath)) {
      runtimeLogs = fs.readFileSync(logPath, "utf-8");
    } else {
      runtimeLogs = "api-runtime.log not found";
    }
  } catch (e: any) {
    runtimeLogs = `Error reading log: ${e.message}`;
  }

  return NextResponse.json({
    status: "debug_info",
    timestamp: new Date().toISOString(),
    cwd,
    internalPort,
    probeResult,
    candidatesStatus,
    runtimeLogs: runtimeLogs.slice(-2000), // last 2KB
    envStatus: {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      JWT_SECRET: Boolean(process.env.JWT_SECRET),
      INTERNAL_API_PORT: process.env.INTERNAL_API_PORT,
    },
  });
}
