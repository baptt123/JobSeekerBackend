import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/global-exception.filter';
import { config } from 'dotenv';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import hbs from 'hbs'; // Import hbs

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cấu hình thư mục Views
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  // Cấu hình thư mục Public (CSS, JS, Images)
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Middleware & Pipes
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Đăng ký Partials
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  hbs.registerPartials(join(__dirname, '..', 'views', 'partials'));

  // ======================================================
  // 👇 QUAN TRỌNG: HELPER HANDLEBARS ĐÃ CẬP NHẬT 👇
  // ======================================================

  // --- CẬP NHẬT HELPER FORMAT TIỀN TỆ (USD, Không thập phân) ---
  hbs.registerHelper('formatCurrency', function (value) {
    if (value === undefined || value === null) return '$0';
    // style: 'currency', currency: 'USD' -> mặc định có .00
    // Thêm maximumFractionDigits: 0 để bỏ số thập phân
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  });
  // Helper: So sánh Role ID và in ra chữ "selected"
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  hbs.registerHelper('isSelected', function (currentValue, targetValue) {
    return currentValue == targetValue ? 'selected' : '';
  });

  // Helper so sánh bằng
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  hbs.registerHelper('eq', (a, b) => a === b);

  // Helper so sánh lớn hơn (Greater Than)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  hbs.registerHelper('gt', (a, b) => a > b);

  // Helper phép cộng
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  hbs.registerHelper('add', (a, b) => Number(a) + Number(b));

  // Helper phép trừ
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  hbs.registerHelper('subtract', (a, b) => Number(a) - Number(b));

  // Helper OR
  hbs.registerHelper('or', function (...args: any[]) {
    args.pop();
    return args.some(Boolean);
  });
  // ======================================================

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Job Seeker API')
    .setDescription('Tài liệu API cho hệ thống tuyển dụng')
    .setVersion('1.0')
    .addTag('users')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}

bootstrap();