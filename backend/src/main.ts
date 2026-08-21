import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConstantsService } from './common/constants/constants.service';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  const constantsService = app.get(ConstantsService);
  // Only this deployment's own frontend. The S3 bucket CORS list (aws.service.ts) is
  // deliberately wider — it is a union across environments. See constants.service.ts.
  const allowedOrigins = constantsService.apiCorsOrigins;

  // Allow local development IPs for mobile testing
  const isDev = process.env.NODE_ENV !== 'production';
  const corsOrigin = isDev
    ? [...allowedOrigins, /^http:\/\/172\.21\.\d+\.\d+:\d+$/]
    : allowedOrigins;

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
