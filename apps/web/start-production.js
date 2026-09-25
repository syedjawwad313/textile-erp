const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("==================================================");
console.log("🚀 Starting Textile & Apparel ERP / MES Platform");
console.log("==================================================");

// 1. Fallback for essential database & auth credentials if not set in cloud env
const DEFAULT_DB_URL =
  "postgresql://neondb_owner:npg_zS4gpXTLHJQ3@ep-quiet-sea-b5ed7y79-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

if (!process.env.DATABASE_URL) {
  console.warn("[Config] DATABASE_URL unset in container. Injecting default Neon cloud database URL.");
  process.env.DATABASE_URL = DEFAULT_DB_URL;
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super-secret-jwt-key-for-development-only";
}

if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = "super-secret-refresh-key-for-development-only";
}

// 2. Port allocation: Next.js gets the public Render PORT, API gets a non-colliding internal port
const publicPort = process.env.PORT || "10000";
const internalApiPort =
  process.env.INTERNAL_API_PORT || (publicPort === "4001" ? "4002" : "4001");

process.env.INTERNAL_API_PORT = String(internalApiPort);

console.log(`[Config] Public Web Port (Render): ${publicPort}`);
console.log(`[Config] Internal API Port: ${internalApiPort}`);

// 3. Locate and spawn backend API
const possibleApiPaths = [
  path.resolve(__dirname, "../api/dist/main.js"),
  path.resolve(__dirname, "../../apps/api/dist/main.js"),
  path.resolve(__dirname, "apps/api/dist/main.js"),
  path.resolve(__dirname, "dist/main.js"),
];

const apiPath = possibleApiPaths.find((p) => fs.existsSync(p));
let apiProcess = null;

const logBuffer = [];
function recordLog(msg) {
  logBuffer.push(msg);
  if (logBuffer.length > 100) logBuffer.shift();
  try {
    const logFilePath = path.resolve(__dirname, "api-runtime.log");
    fs.appendFileSync(logFilePath, msg + "\n");
  } catch {}
}

if (apiPath) {
  const apiCwd = path.dirname(path.dirname(apiPath));
  console.log(`[Startup] Launching embedded NestJS API from: ${apiPath}`);
  console.log(`[Startup] Backend working directory: ${apiCwd}`);

  const apiEnv = {
    ...process.env,
    PORT: String(internalApiPort),
    NODE_ENV: "production",
  };

  apiProcess = spawn(process.execPath, [apiPath], {
    env: apiEnv,
    cwd: apiCwd,
  });

  apiProcess.stdout.on("data", (data) => {
    const text = data.toString();
    process.stdout.write(`[API] ${text}`);
    recordLog(`[STDOUT] ${text}`);
  });

  apiProcess.stderr.on("data", (data) => {
    const text = data.toString();
    process.stderr.write(`[API ERR] ${text}`);
    recordLog(`[STDERR] ${text}`);
  });

  apiProcess.on("error", (err) => {
    console.error("[Backend API Error]:", err);
    recordLog(`[ERROR] ${err.stack || err.message}`);
  });

  apiProcess.on("exit", (code, signal) => {
    console.warn(`[Backend API Exit] Code: ${code}, Signal: ${signal}`);
    recordLog(`[EXIT] code=${code} signal=${signal}`);
  });
} else {
  console.warn(
    "[Startup Warning] apps/api/dist/main.js not found. Web service will rely on external API_URL."
  );
}

// 4. Start Next.js Web on public port
const nextBin = require.resolve("next/dist/bin/next");
console.log(`[Startup] Starting Next.js Web on 0.0.0.0:${publicPort}...`);

const nextEnv = {
  ...process.env,
  PORT: String(publicPort),
  INTERNAL_API_PORT: String(internalApiPort),
  NODE_ENV: "production",
};

const nextProcess = spawn(
  process.execPath,
  [nextBin, "start", "-p", String(publicPort), "-H", "0.0.0.0"],
  {
    env: nextEnv,
    stdio: "inherit",
    cwd: __dirname,
  }
);

nextProcess.on("error", (err) => {
  console.error("[Next.js Web Error]:", err);
});

nextProcess.on("exit", (code) => {
  if (apiProcess && !apiProcess.killed) {
    try {
      apiProcess.kill("SIGTERM");
    } catch {}
  }
  process.exit(code || 0);
});

// 5. Handle container termination signals
const handleShutdown = (signal) => {
  console.log(`[Shutdown] Received ${signal}. Terminating services...`);
  if (nextProcess && !nextProcess.killed) {
    try {
      nextProcess.kill(signal);
    } catch {}
  }
  if (apiProcess && !apiProcess.killed) {
    try {
      apiProcess.kill(signal);
    } catch {}
  }
  process.exit(0);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
