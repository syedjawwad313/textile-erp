const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("==================================================");
console.log("🚀 Starting Textile & Apparel ERP / MES Platform");
console.log("==================================================");

// 1. Port allocation: Next.js gets the public Render PORT, API gets a non-colliding internal port
const publicPort = process.env.PORT || "10000";
const internalApiPort =
  process.env.INTERNAL_API_PORT || (publicPort === "4001" ? "4002" : "4001");

process.env.INTERNAL_API_PORT = String(internalApiPort);

console.log(`[Config] Public Web Port (Render): ${publicPort}`);
console.log(`[Config] Internal API Port: ${internalApiPort}`);

// 2. Locate and spawn backend API if available
const possibleApiPaths = [
  path.resolve(__dirname, "../api/dist/main.js"),
  path.resolve(__dirname, "../../apps/api/dist/main.js"),
  path.resolve(__dirname, "apps/api/dist/main.js"),
  path.resolve(__dirname, "dist/main.js"),
];

const apiPath = possibleApiPaths.find((p) => fs.existsSync(p));
let apiProcess = null;

if (apiPath) {
  const apiCwd = path.dirname(path.dirname(apiPath));
  console.log(`[Startup] Launching embedded NestJS API from: ${apiPath}`);
  console.log(`[Startup] Backend working directory: ${apiCwd}`);

  const apiEnv = {
    ...process.env,
    PORT: String(internalApiPort),
    NODE_ENV: process.env.NODE_ENV || "production",
  };

  apiProcess = spawn(process.execPath, [apiPath], {
    env: apiEnv,
    stdio: "inherit",
    cwd: apiCwd,
  });

  apiProcess.on("error", (err) => {
    console.error("[Backend API Error]:", err);
  });

  apiProcess.on("exit", (code, signal) => {
    console.warn(`[Backend API Exit] Code: ${code}, Signal: ${signal}`);
  });
} else {
  console.warn(
    "[Startup Warning] apps/api/dist/main.js not found. Web service will rely on external API_URL."
  );
}

// 3. Start Next.js Web on public port
const nextBin = require.resolve("next/dist/bin/next");
console.log(`[Startup] Starting Next.js Web on 0.0.0.0:${publicPort}...`);

const nextEnv = {
  ...process.env,
  PORT: String(publicPort),
  INTERNAL_API_PORT: String(internalApiPort),
  NODE_ENV: process.env.NODE_ENV || "production",
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

// 4. Handle container termination signals
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
