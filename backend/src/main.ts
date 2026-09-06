import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

/**
 * Browser origins allowed to call the API. Comma-separated so a deployed API
 * can serve both the production frontend and a preview/staging URL - Vercel
 * gives every branch its own hostname, and a single-origin CORS config would
 * lock those out.
 */
function allowedOrigins(): string[] {
  return (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Bind every interface, not just loopback: container platforms (Render,
  // Fly, Docker) route external traffic to the container's own address.
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
await bootstrap();
