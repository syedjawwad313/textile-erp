import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "nestjs-pino";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  // Enable CORS — configure allowed origins safely for production
  const rawOrigins =
    process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL;
  let corsOrigin: (string | RegExp)[] | boolean = true;

  if (rawOrigins) {
    const origins: (string | RegExp)[] = rawOrigins
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean);

    // In non-production, ensure localhost:3000 is always accessible
    if (
      process.env.NODE_ENV !== "production" &&
      !origins.includes("http://localhost:3000")
    ) {
      origins.push("http://localhost:3000");
    }
    corsOrigin = origins;
  } else if (process.env.NODE_ENV === "production") {
    // In production on Render/cloud without explicit FRONTEND_URL,
    // allow all *.onrender.com subdomains and localhost for fallback/testing
    corsOrigin = [
      /https:\/\/.*\.onrender\.com$/,
      "http://localhost:3000",
      "http://localhost:3001",
    ];
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global prefix (excluding health/readiness checks so Render probe at /health succeeds)
  app.setGlobalPrefix("api/v1", {
    exclude: ["health", "health/readiness", "ready"],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Application is running on port ${port}/api/v1`);
}
bootstrap();
