import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConstantsService } from './common/constants/constants.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const constantsService = app.get(ConstantsService);
  const frontendUrl = constantsService.private.FRONTEND_URL;
  
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  const port = process.env.PORT || 6767;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
