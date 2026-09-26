"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const nestjs_pino_1 = require("nestjs-pino");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL;
    let corsOrigin = true;
    if (rawOrigins) {
        const origins = rawOrigins
            .split(",")
            .map((o) => o.trim().replace(/\/+$/, ""))
            .filter(Boolean);
        if (process.env.NODE_ENV === "production") {
            origins.push(/https:\/\/.*\.onrender\.com$/);
        } else {
            if (!origins.includes("http://localhost:3000")) {
                origins.push("http://localhost:3000");
            }
        }
        corsOrigin = origins;
    }
    else if (process.env.NODE_ENV === "production") {
        corsOrigin = [
            /https:\/\/.*\.onrender\.com$/,
            "http://localhost:3000",
            "http://localhost:3001",
        ];
    }
    app.enableCors({
        origin: corsOrigin,
        credentials: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "x-tenant-id",
            "Accept",
            "Origin",
            "X-Requested-With",
        ],
        exposedHeaders: ["Authorization"],
    });
    app.setGlobalPrefix("api/v1", {
        exclude: ["health", "health/readiness", "ready"],
    });
    const port = process.env.PORT || 3001;
    await app.listen(port, "0.0.0.0");
    console.log(`🚀 Application is running on port ${port}/api/v1`);
}
bootstrap();
//# sourceMappingURL=main.js.map