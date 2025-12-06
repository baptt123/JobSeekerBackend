import { GenerateCvService } from './generate-cv.service';
import express from 'express';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { GenerateCvDto } from '../dto/generative-cv-prompt.dto';
import { CreateCvDto } from '../dto/create-cv.dto';

@Controller('cv')
export class GenerateCvController {
  constructor(private readonly generateCvService: GenerateCvService) {}

  /**
   * 1. AI Generate CV -> Trả về file PDF để download/view ngay
   */
  @Post('gen-cv')
  @HttpCode(200)
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  public async generateCv(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: GenerateCvDto,
    @Res() res: express.Response,
  ) {
    try {
      // B1: Lấy HTML từ AI
      const html = await this.generateCvService.getCvHtml(dto.prompt);

      // B2: Convert HTML sang PDF Buffer (Logic đã chuyển vào Service)
      const pdfBuffer = await this.generateCvService.generatePdfFromHtml(html);

      // B3: Trả về file PDF stream
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=ai-generated-cv.pdf',
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Lỗi Gen CV:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Không thể tạo CV lúc này. Vui lòng thử lại.',
      });
    }
  }

  /**
   * 2. Preview Template (Render HTML)
   * Dùng để xem trước trên Web/App trước khi tải
   */
  @Post('preview/:templateId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  previewCvTemplate(
    @Param('templateId') templateId: string,
    @Body() cvData: CreateCvDto,
    @Res() res: express.Response,
  ) {
    const viewName = this._getTemplateViewName(templateId);
    // Render HBS ra HTML và trả về client
    res.render(viewName, { cv: cvData });
  }

  /**
   * 3. Download Template (Render PDF)
   * Thực tế: Client gửi Data -> Server điền vào Template -> Server tạo PDF -> Trả về file
   */
  @Post('download/:templateId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async downloadCvTemplate(
    @Param('templateId') templateId: string,
    @Body() cvData: CreateCvDto,
    @Res() res: express.Response,
  ) {
    // Lưu ý: Để render HBS thành HTML string trong Controller hơi phức tạp ở NestJS
    // Cách đơn giản nhất cho Demo: Frontend render HTML rồi gửi HTML string lên để convert PDF.
    // Cách "Chuẩn" Backend: Dùng engine handlebars để compile string thủ công.

    // Ở đây mình giả định bạn đã có HTML string (hoặc dùng AI generate service để convert)
    // Để code chạy được ngay, mình sẽ dùng render của AI Service như một ví dụ
    // Thực tế bạn cần: const html = compileHbs(templateId, cvData);

    try {
      // Code giả lập việc compile template thành HTML String
      const htmlMock = `<html><body><h1>CV của ${cvData.fullName || 'Bạn'}</h1><p>Generated from ${templateId}</p></body></html>`;

      const pdfBuffer =
        await this.generateCvService.generatePdfFromHtml(htmlMock);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cv_${templateId}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new BadRequestException('Lỗi tạo file PDF từ template');
    }
  }

  /**
   * 4. Scan PDF (Tính năng Upload & Parse CV)
   * Thực tế: User upload file -> Server lưu -> Trả về Text để User check lại
   */
  @Post('scan-pdf')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @UseInterceptors(FileInterceptor('file'))
  async scanPdf(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any, // ✅ Lấy Request để truy cập user
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file PDF.');
    }

    // ✅ Lấy userId thật từ Token (đã qua Guard)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;

    console.log(
      `[SCAN_PDF] User ${userId} đang upload file: ${file.originalname}`,
    );

    // Gọi Service xử lý toàn bộ
    return this.generateCvService.processScanCV(file, userId);
  }

  // Helper
  private _getTemplateViewName(id: string): string {
    const map = {
      template1: 'cv_template_1',
      template2: 'cv_template_2',
    };
    if (!map[id]) throw new BadRequestException('Template không tồn tại');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return map[id];
  }
  /**
   * 5. [NEW] Lấy danh sách CV của tôi
   */
  @Get('my-cvs')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN')
  async getMyCvs(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const cvs = await this.generateCvService.getMyCvs(userId);
    return { data: cvs };
  }

  /**
   * 6. [NEW] Upload CV mới (Dạng quản lý file)
   */
  @Post('upload')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Body('title') title?: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file PDF');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;

    // Dùng hàm upload đơn giản hoặc hàm scan cũ tùy bạn (ở đây dùng hàm simple mới tạo)
    const result = await this.generateCvService.uploadCvSimple(
      file,
      userId,
      title,
    );
    return { message: 'Upload CV thành công', data: result };
  }

  /**
   * 7. [NEW] Đặt CV mặc định
   */
  @Patch(':id/set-default')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN')
  async setDefaultCv(@Param('id') id: string, @Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    await this.generateCvService.setDefaultCv(userId, +id);
    return { message: 'Đã đặt CV làm mặc định' };
  }

  /**
   * 8. [NEW] Xóa CV
   */
  @Delete(':id')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN')
  async deleteCv(@Param('id') id: string, @Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    await this.generateCvService.deleteCv(userId, +id);
    return { message: 'Đã xóa CV' };
  }
}
