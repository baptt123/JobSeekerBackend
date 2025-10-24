import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/global-exception.filter';
import { config } from 'dotenv';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express'; // ⚡ thêm dòng này
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
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}

bootstrap();
