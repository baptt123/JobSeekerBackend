import { GenerateCvService } from './generate-cv.service';
import { RolesGuard } from '../guard/role-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { CreateUserCvDto } from '../dto/create-cv.dto';
import { UserCVEntity } from '../entity/user-cv.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import express from 'express';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import { GenerateCvDto } from '../dto/generative-cv-prompt.dto';
import puppeteer from 'puppeteer';

@Controller('cv')
export class GenerateCvController {
  constructor(
    private readonly generateCvService: GenerateCvService,
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('ADMIN', 'RECRUITER', 'USER')
  @Post('gen-cv')
  public async generateCv(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: GenerateCvDto,
    @Res() res: express.Response,
  ) {
    // 1. Sinh HTML từ AI
    const html = await this.generateCvService.getCvHtml(dto.prompt);

    // 2. Launch Puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // 3. Thêm style font hệ thống để tránh lỗi Google Fonts
    const htmlWithFont = `
      <style>
        body { font-family: Arial, Helvetica, sans-serif; }
      </style>
      ${html}
    `;
    await page.setContent(htmlWithFont, { waitUntil: 'networkidle0' });

    // 4. Render PDF
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // 5. Set header để Postman tải/hiển thị PDF đúng
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=cv.pdf'); // 'attachment' nếu muốn tải về
    res.setHeader('Content-Length', pdfBuffer.length);

    // 6. Gửi PDF
    res.send(pdfBuffer);
  }

  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @Get('save-cv')
  public async saveCV(@Body() dto: CreateUserCvDto): Promise<UserCVEntity> {
    return await this.generateCvService.createCVWithKeywords(dto);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles('USER', 'ADMIN', 'RECRUITER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCV(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('content') content: string,
    @Body('keywords') keywords: string,
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;

    // Upload lên Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(file);
    return this.generateCvService.saveCVAfterUpload(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      userId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      uploadResult.secure_url,
      title,
      content,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      JSON.parse(keywords),
    );
  }
}
