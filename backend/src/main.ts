import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConstantsService } from './common/constants/constants.service';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  const constantsService = app.get(ConstantsService);
  const frontendUrl = constantsService.private.FRONTEND_URL;
  const extraCorsOrigins = constantsService.private.EXTRA_CORS_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Allow local development IPs for mobile testing
  const isDev = process.env.NODE_ENV !== 'production';
  const corsOrigin = isDev
    ? [frontendUrl, /^http:\/\/172\.21\.\d+\.\d+:\d+$/, ...extraCorsOrigins]
    : [frontendUrl, ...extraCorsOrigins];

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = constantsService.private.BACKEND_PORT;
  await app.listen(port);
  console.log(`${constantsService.private.NODE_ENV}: Application is running on: ${port}`);
}
bootstrap();
