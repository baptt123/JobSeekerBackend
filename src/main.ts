import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filter/global-exception.filter';
import { config } from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configure = new DocumentBuilder()
    .setTitle('My API') // Tên API
    .setDescription('API description') // Mô tả API
    .setVersion('1.0') // Version
    .addBearerAuth() // Nếu dùng JWT Auth
    .build();
  const document = SwaggerModule.createDocument(app, configure);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true }, // giữ token sau khi nhập
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}
bootstrap();
