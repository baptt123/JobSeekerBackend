import { GenerateCvService } from './generate-cv.service';
import express from 'express';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import { GenerateCvDto } from '../dto/generative-cv-prompt.dto';
import puppeteer from 'puppeteer';
import { CreateCvDto } from '../dto/create-cv.dto';
import { Response } from 'express';

@Controller('cv')
export class GenerateCvController {
  constructor(
    private readonly generateCvService: GenerateCvService,
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('ADMIN', 'RECRUITER', 'USER')

  @Post('gen-cv')
  @HttpCode(200)
  public async generateCv(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: GenerateCvDto,
    @Res() res: express.Response,
  ) {
    let browser; // Khai báo browser ở ngoài để có thể đóng nếu lỗi

    try {
      // 1. Sinh HTML từ AI
      console.log('[CV_GEN] Bắt đầu gọi AI...');
      const html = await this.generateCvService.getCvHtml(dto.prompt);
      console.log('[CV_GEN] Đã nhận HTML từ AI.');

      // 2. Launch Puppeteer
      console.log('[CV_GEN] Khởi động Puppeteer...');
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Thêm cờ này để tránh lỗi bộ nhớ chia sẻ
        ],
      });
      console.log('[CV_GEN] Puppeteer đã khởi động.');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const page = await browser.newPage();

      // 3. Thêm style font
      const htmlWithFont = `
 <style>
 body { font-family: Arial, Helvetica, sans-serif; }
 </style>
 ${html} `;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await page.setContent(htmlWithFont, { waitUntil: 'networkidle0' });

      // 4. Render PDF
      console.log('[CV_GEN] Đang render PDF...');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      console.log('[CV_GEN] Đã render PDF.');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await browser.close();
      browser = null; // Đặt lại là null sau khi đóng

      // 5. Set header
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=cv.pdf');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      res.setHeader('Content-Length', pdfBuffer.length);

      // 6. Gửi PDF
      res.send(pdfBuffer);
    } catch (error) {
      // ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT
      console.error('LỖI NGHIÊM TRỌNG KHI TẠO CV:', error);

      // Đảm bảo đóng trình duyệt nếu nó đã được mở
      if (browser) {
        console.log('[CV_GEN] Đóng trình duyệt do lỗi...');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        await browser.close();
      }

      // Trả về lỗi 500 với thông điệp chi tiết
      // Bạn không nên dùng res.send ở đây nếu đã dùng HttpException
      // Nhưng vì bạn đang dùng @Res(), nên dùng res.status()
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        message: 'Lỗi khi tạo CV, chi tiết: ' + error.message,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        error: error.stack, // Gửi cả stack trace để debug dễ hơn
      });
    }
  }

  /*
   ================================================================
   ✅ BẮT ĐẦU CHỨC NĂNG MỚI: TẠO CV TỪ TEMPLATE
   ================================================================
   */

  /**
   * Endpoint này nhận dữ liệu CV và ID của template,
   * sau đó render template HBS tương ứng với dữ liệu đó.
   * @param templateId 'template1' hoặc 'template2'
   * @param cvData Dữ liệu CV người dùng nhập
   * @param res
   */
  @Post('preview/:templateId')
  async previewCvTemplate(
    @Param('templateId') templateId: string,
    @Body() cvData: CreateCvDto,
    @Res() res: express.Response,
  ): Promise<void> {
    // <-- Thêm kiểu trả về Promise<void>
    let viewName: string;
    if (templateId === 'template1') {
      viewName = 'cv_template_1';
    } else if (templateId === 'template2') {
      viewName = 'cv_template_2';
    } else {
      // Dùng cách của NestJS để ném lỗi
      throw new BadRequestException('Invalid template ID');
    }

    // Render file HBS với dữ liệu từ body
    // Dữ liệu truyền vào HBS phải là một object
    res.render(viewName, { cv: cvData });
  }

  /**
   * Endpoint này dùng để tải về (hiện tại chỉ là render lại)
   * Trong thực tế, đây là nơi gọi service để tạo PDF
   */
  @Post('download/:templateId')
  @HttpCode(200)
  async downloadCvTemplate(
    @Param('templateId') templateId: string,
    @Body() cvData: CreateCvDto,
    @Res() res: express.Response,
  ): Promise<void> {
    // <-- Thêm kiểu trả về Promise<void>
    // TODO: Triển khai logic tạo PDF (ví dụ: dùng Puppeteer)

    let viewName: string;
    if (templateId === 'template1') {
      viewName = 'cv_template_1';
    } else if (templateId === 'template2') {
      viewName = 'cv_template_2';
    } else {
      // Dùng cách của NestJS để ném lỗi
      throw new BadRequestException('Invalid template ID');
    }

    // Thiết lập header để gợi ý tải về (mặc dù nó là HTML)
    // Cú pháp này vẫn đúng và không có gì thay đổi
    res.setHeader('Content-Disposition', 'attachment; filename="my_cv.html"');
    res.render(viewName, { cv: cvData });
  }
}
