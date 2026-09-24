import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  // Enable CORS — allow the deployed frontend or any origin in development
  const allowedOrigin = process.env.FRONTEND_URL;
  app.enableCors({
    origin: allowedOrigin ? [allowedOrigin, 'http://localhost:3000'] : true,
    credentials: true,
  });

  // Global prefix (excluding health checks so Render probe at /health succeeds)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/readiness'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on port ${port}/api/v1`);
}
bootstrap();

