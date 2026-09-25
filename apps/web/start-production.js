const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("==================================================");
console.log("🚀 Starting Textile & Apparel ERP / MES Platform");
console.log("==================================================");

// 1. Locate apps/api/dist/main.js
const possibleApiPaths = [
  path.resolve(__dirname, "../api/dist/main.js"),
  path.resolve(__dirname, "../../apps/api/dist/main.js"),
  path.resolve(__dirname, "apps/api/dist/main.js"),
  path.resolve(__dirname, "dist/main.js"),
];

const apiPath = possibleApiPaths.find((p) => fs.existsSync(p));

if (apiPath) {
  console.log(`[Startup] Found backend API at: ${apiPath}`);
  const apiCwd = path.dirname(path.dirname(apiPath));
  console.log(`[Startup] Backend CWD: ${apiCwd}`);

  const apiEnv = {
    ...process.env,
    PORT: "3001",
    NODE_ENV: "production",
  };

  const apiProcess = spawn(process.execPath, [apiPath], {
    env: apiEnv,
    stdio: "inherit",
    cwd: apiCwd,
  });

  apiProcess.on("error", (err) => {
    console.error("[Backend API Error]:", err);
  });

  apiProcess.on("exit", (code) => {
    console.log(`[Backend API Exit] Code: ${code}`);
  });
} else {
  console.warn(
    "[Startup Warning] Local backend API not found. Web service will rely on external API_URL."
  );
}

// 2. Start Next.js Web
const nextBin = require.resolve("next/dist/bin/next");
const webPort = process.env.PORT && process.env.PORT !== "3001" ? process.env.PORT : "10000";
console.log(`[Startup] Starting Next.js Web on port ${webPort}...`);

const nextProcess = spawn(
  process.execPath,
  [nextBin, "start", "-p", webPort, "-H", "0.0.0.0"],
  {
    env: {
      ...process.env,
      PORT: webPort,
      NODE_ENV: "production",
    },
    stdio: "inherit",
    cwd: __dirname,
  }
);

nextProcess.on("error", (err) => {
  console.error("[Next.js Web Error]:", err);
});

nextProcess.on("exit", (code) => {
  process.exit(code || 0);
});
