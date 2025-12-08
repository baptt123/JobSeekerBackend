// src/cv/generate-cv.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import express from 'express';
import { GenerateCvService } from './generate-cv.service';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { GenerateCvDto } from '../dto/generative-cv-prompt.dto';
import { CreateCvDto } from '../dto/create-cv.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('cv')
export class GenerateCvController {
  constructor(private readonly generateCvService: GenerateCvService) {}

  // 1. CHỨC NĂNG TẠO CV BẰNG GEMINI (Không lưu DB)
  @Post('gen-cv')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  public async generateCv(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: GenerateCvDto,
    @Res() res: express.Response,
  ) {
    try {
      // B1: AI tạo nội dung HTML
      const html = await this.generateCvService.getCvHtml(dto.prompt);

      // B2: Puppeteer tạo PDF Buffer (Chỉ tạo file trong RAM, không lưu DB)
      const pdfBuffer = await this.generateCvService.generatePdfFromHtml(html);

      // B3: Trả về file trực tiếp cho Client
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=cv-gemini.pdf',
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Lỗi khi tạo CV với Gemini.' });
    }
  }
  // 2. CHỨC NĂNG TẠO CV TỪ TEMPLATE (Không lưu DB)
  // Endpoint này dùng để Client tải về bản PDF cuối cùng
  @Post('download/:templateId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async downloadCvTemplate(
    @Param('templateId') templateId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    cvData: CreateCvDto,
    @Res() res: express.Response,
  ) {
    try {
      // B1: Compile HTML từ dữ liệu người dùng nhập
      const html = await this.generateCvService.compileTemplate(
        templateId,
        cvData,
      );

      // B2: Puppeteer tạo PDF Buffer (Chỉ tạo file, không lưu DB)
      const pdfBuffer = await this.generateCvService.generatePdfFromHtml(html);

      // B3: Trả về file trực tiếp
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CV_${cvData.fullName}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new BadRequestException('Lỗi tải xuống CV từ Template');
    }
  }

  @Post('scan-pdf')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @UseInterceptors(FileInterceptor('file'))
  async scanPdf(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file PDF.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;

    // Gọi hàm xử lý toàn diện
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.generateCvService.processScanCV(file, userId);
  }

  /**
   * 5. Lấy danh sách CV của tôi
   */
  @Get('my-cvs')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async getMyCvs(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const cvs = await this.generateCvService.getMyCvs(userId);
    return { data: cvs };
  }

  /**
   * 6. Upload CV mới (Dạng quản lý file)
   */
  @Post('upload')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Body('title') title?: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file PDF');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;

    const result = await this.generateCvService.uploadCvSimple(
      file,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      userId,
      title,
    );
    return { message: 'Upload CV thành công', data: result };
  }

  /**
   * 7. Đặt CV mặc định
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
   * 8. Xóa CV
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
  // API 1: Xem trước (Preview)
  @Post('preview/:templateId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async previewCv(
    @Param('templateId') templateId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCvDto,
    @Res() res: express.Response,
  ) {
    const html = await this.generateCvService.compileTemplate(templateId, dto);
    const pdfBuffer = await this.generateCvService.generatePdfFromHtml(html);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename=preview.pdf',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  // API 2: Lưu CV
  @Post('save-generated/:templateId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async saveGeneratedCv(
    @Param('templateId') templateId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCvDto,
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const result = await this.generateCvService.generateAndSaveCvFromTemplate(
      userId,
      templateId,
      dto,
    );
    return { message: 'Lưu CV thành công', data: result };
  }
}
