import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { allowedOrigins } from './cors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: allowedOrigins() });

  // Si existe el build del frontend (frontend/dist), el backend lo sirve:
  // asi toda la app queda en una sola URL publica.
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    app.useStaticAssets(frontendDist);
  }

  // Los hostings (Render, Railway, etc.) te dan el puerto en la variable PORT.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
