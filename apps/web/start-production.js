const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const logBuffer = [];
function recordLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logBuffer.push(line);
  if (logBuffer.length > 200) logBuffer.shift();
  try {
    const logFilePath = path.resolve(__dirname, "api-runtime.log");
    fs.appendFileSync(logFilePath, line + "\n");
  } catch {}
}

console.log("==================================================");
console.log("🚀 Starting Textile & Apparel ERP / MES Platform");
console.log("==================================================");
recordLog("🚀 Starting Textile & Apparel ERP / MES Platform");

// 1. Fallback for essential database & auth credentials if not set in cloud env
const DEFAULT_DB_URL =
  "postgresql://neondb_owner:npg_zS4gpXTLHJQ3@ep-quiet-sea-b5ed7y79-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

if (!process.env.DATABASE_URL) {
  console.warn("[Config] DATABASE_URL unset in container. Injecting default Neon cloud database URL.");
  recordLog("[Config] Injected default Neon cloud database URL");
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
recordLog(`[Config] Public Web Port: ${publicPort}, Internal API Port: ${internalApiPort}`);

// 3. Ensure Prisma Client is generated and database is prepared in runtime environment
const monorepoRoot = path.resolve(__dirname, "../..");

const schemaCandidates = [
  path.resolve(__dirname, "../../packages/database/prisma/schema.prisma"),
  path.resolve(__dirname, "../packages/database/prisma/schema.prisma"),
  path.resolve(__dirname, "packages/database/prisma/schema.prisma"),
  path.resolve(process.cwd(), "../../packages/database/prisma/schema.prisma"),
  path.resolve(process.cwd(), "../packages/database/prisma/schema.prisma"),
  path.resolve(process.cwd(), "packages/database/prisma/schema.prisma"),
];
const schemaPath = schemaCandidates.find((p) => fs.existsSync(p));

const prismaCliCandidates = [
  path.resolve(monorepoRoot, "node_modules/prisma/build/index.js"),
  path.resolve(monorepoRoot, "packages/database/node_modules/prisma/build/index.js"),
  path.resolve(__dirname, "node_modules/prisma/build/index.js"),
  path.resolve(__dirname, "../../node_modules/prisma/build/index.js"),
  path.resolve(__dirname, "../node_modules/prisma/build/index.js"),
];
const prismaCli = prismaCliCandidates.find((p) => fs.existsSync(p));

if (schemaPath) {
  recordLog(`[Startup] Found schema at: ${schemaPath}`);
  let generated = false;

  // 3a. Try direct Node execution of Prisma CLI (most reliable in container)
  if (prismaCli) {
    try {
      recordLog(`[Startup] Generating Prisma Client via Node: ${prismaCli}`);
      execSync(`"${process.execPath}" "${prismaCli}" generate --schema="${schemaPath}"`, {
        cwd: path.dirname(schemaPath),
        stdio: "inherit",
        env: process.env,
      });
      generated = true;
      recordLog("[Startup] Prisma Client generated successfully via Node CLI.");
    } catch (nodePrismaErr) {
      recordLog(`[Startup Warning] Node Prisma CLI failed: ${nodePrismaErr.message}`);
    }
  }

  // 3b. Fallbacks if direct Node CLI wasn't found or errored
  if (!generated) {
    try {
      recordLog("[Startup] Attempting pnpm db:generate...");
      execSync("pnpm --filter @textile-erp/database run db:generate", {
        cwd: monorepoRoot,
        stdio: "inherit",
        env: process.env,
      });
      generated = true;
      recordLog("[Startup] pnpm db:generate succeeded.");
    } catch {
      try {
        recordLog("[Startup] Attempting npx prisma generate...");
        execSync(`npx prisma generate --schema="${schemaPath}"`, {
          cwd: monorepoRoot,
          stdio: "inherit",
          env: process.env,
        });
        generated = true;
        recordLog("[Startup] npx prisma generate succeeded.");
      } catch (npxErr) {
        recordLog(`[Startup Warning] Prisma generation fallback error: ${npxErr.message}`);
      }
    }
  }

  // 3c. Verify/Push database tables to Neon (idempotent, auto-creates tables if fresh DB)
  if (prismaCli && process.env.DATABASE_URL) {
    try {
      recordLog("[Startup] Synchronizing database tables (db push)...");
      execSync(`"${process.execPath}" "${prismaCli}" db push --skip-generate --schema="${schemaPath}"`, {
        cwd: path.dirname(schemaPath),
        stdio: "inherit",
        env: process.env,
        timeout: 30000,
      });
      recordLog("[Startup] Database tables synchronized on Neon.");
    } catch (pushErr) {
      recordLog(`[Startup Notice] db push notice: ${pushErr.message}`);
    }
  }

  // 3d. Ensure default seed data (demo tenant, admin user)
  const seedCandidates = [
    path.resolve(monorepoRoot, "packages/database/prisma/seed.js"),
    path.resolve(__dirname, "../../packages/database/prisma/seed.js"),
    path.resolve(__dirname, "../packages/database/prisma/seed.js"),
  ];
  const seedPath = seedCandidates.find((p) => fs.existsSync(p));
  if (seedPath && process.env.DATABASE_URL) {
    try {
      recordLog(`[Startup] Ensuring seed data using: ${seedPath}`);
      execSync(`"${process.execPath}" "${seedPath}"`, {
        cwd: path.dirname(seedPath),
        stdio: "inherit",
        env: process.env,
        timeout: 25000,
      });
      recordLog("[Startup] Default seed verified (admin@acmetextiles.com ready).");
    } catch (seedErr) {
      recordLog(`[Startup Notice] Seed notice: ${seedErr.message}`);
    }
  }
} else {
  recordLog("[Startup Warning] Prisma schema.prisma not located.");
}

// 4. Locate and spawn backend NestJS API
const possibleApiPaths = [
  path.resolve(__dirname, "../api/dist/main.js"),
  path.resolve(__dirname, "../../apps/api/dist/main.js"),
  path.resolve(__dirname, "apps/api/dist/main.js"),
  path.resolve(__dirname, "../apps/api/dist/main.js"),
  path.resolve(__dirname, "dist/main.js"),
  path.resolve(process.cwd(), "../api/dist/main.js"),
  path.resolve(process.cwd(), "../../apps/api/dist/main.js"),
];

const apiPath = possibleApiPaths.find((p) => fs.existsSync(p));
let apiProcess = null;

if (apiPath) {
  const apiCwd = path.dirname(path.dirname(apiPath));
  console.log(`[Startup] Launching embedded NestJS API from: ${apiPath}`);
  console.log(`[Startup] Backend working directory: ${apiCwd}`);
  recordLog(`[Startup] Launching embedded NestJS API from: ${apiPath} (Port ${internalApiPort})`);

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
    recordLog(`[STDOUT] ${text.trim()}`);
  });

  apiProcess.stderr.on("data", (data) => {
    const text = data.toString();
    process.stderr.write(`[API ERR] ${text}`);
    recordLog(`[STDERR] ${text.trim()}`);
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
  recordLog("[Startup Warning] apps/api/dist/main.js not found.");
}

// 5. Start Next.js Web on public port
const nextBin = require.resolve("next/dist/bin/next");
console.log(`[Startup] Starting Next.js Web on 0.0.0.0:${publicPort}...`);
recordLog(`[Startup] Starting Next.js Web on 0.0.0.0:${publicPort}...`);

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
  recordLog(`[Next.js Error] ${err.stack || err.message}`);
});

nextProcess.on("exit", (code) => {
  if (apiProcess && !apiProcess.killed) {
    try {
      apiProcess.kill("SIGTERM");
    } catch {}
  }
  process.exit(code || 0);
});

// 6. Handle container termination signals
const handleShutdown = (signal) => {
  console.log(`[Shutdown] Received ${signal}. Terminating services...`);
  recordLog(`[Shutdown] Received ${signal}. Terminating services...`);
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
