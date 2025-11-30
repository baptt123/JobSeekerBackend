import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/global-exception.filter';
import { config } from 'dotenv';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // ⚡ thêm dòng này
config();

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setBaseViewsDir(join(__dirname, '..', 'views')); // thư mục chứa HTML template
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'public')); // nơi chứa CSS, ảnh, JS tĩnh
  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Hướng dẫn test API backend Nestjs') // Tiêu đề
    .setDescription('Hướng dẫn chạy demo test API') // Mô tả
    .setVersion('1.0') // Version
    .addTag('users') // Tag để nhóm các API (tùy chọn)
    .addBearerAuth() // Thêm cấu hình JWT Auth (nếu cần)
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup đường dẫn truy cập Swagger (VD: localhost:3000/api)
  SwaggerModule.setup('api', app, document);
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}

bootstrap();
