import { Controller, Post, UploadedFile, UseInterceptors, Body, Res, Get, Patch, Delete, Param, UseGuards, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerateCvService } from './generate-cv.service';
import express from 'express';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
// import { GenerateTemplateDto } from '../dto/generate-template.dto';

@Controller('cv')
@UseGuards(OrAuthGuard)
@Roles("ADMIN", "RECRUITER", "CANDIDATE")
export class GenerateCvController {
  constructor(private readonly service: GenerateCvService) {}

  // --- API MỚI: Upload và Phân tích CV bằng Gemini 2.5 ---
  @Post('upload-parse-cv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndParseCv(@UploadedFile() file: Express.Multer.File, @Req() req) {
    // userId lấy từ token (req.user.userId)
    return this.service.processCvWithGemini(file, req.user.userId);
  }

  // --- CÁC HÀM CŨ GIỮ NGUYÊN ---
  @Post('upload-extract')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req) {
    return this.service.uploadAndExtractKeywords(file, req.user.userId);
  }

  @Post('generate-ai')
  async generateAi(@Body('prompt') prompt: string, @Res() res: express.Response, @Req() req) {
    const pdfBuffer = await this.service.generateCvByAi(prompt, req.user.userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv_ai_generated.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  // @Post('generate-template')
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  // async generateTemplate(@Body() body: GenerateTemplateDto, @Res() res: express.Response, @Req() req) {
  //   const pdfBuffer = await this.service.generateCvFromTemplate(body.templateId, body.data, req.user.userId);
  //   res.set({
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': `attachment; filename="cv_template_${body.templateId}.pdf"`,
  //     'Content-Length': pdfBuffer.length,
  //   });
  //   res.send(pdfBuffer);
  // }

  @Get('list')
  async list(@Req() req) {
    return this.service.getMyCvs(req.user.userId);
  }

  @Patch('set-default/:id')
  async setDefault(@Param('id') id: number, @Req() req) {
    return this.service.setDefaultCv(id, req.user.userId);
  }

  @Delete('delete/:id')
  async delete(@Param('id') id: number, @Req() req) {
    return this.service.softDeleteCv(id, req.user.userId);
  }
}