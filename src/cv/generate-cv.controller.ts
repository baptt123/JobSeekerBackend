import { Controller, Post, UploadedFile, UseInterceptors, Body, Res, Get, Patch, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerateCvService } from './generate-cv.service';
import express, { Response } from 'express';
// Giả định bạn có Guard xác thực
import { JwtAuthGuard } from '../guard/jwt-auth.guard';

@Controller('cv')
@UseGuards(JwtAuthGuard)
export class GenerateCvController {
  constructor(private readonly service: GenerateCvService) {}

  @Post('upload-extract')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req) {
    return this.service.uploadAndExtractKeywords(file, req.user.id);
  }

  @Post('generate-ai')
  async generateAi(@Body('prompt') prompt: string, @Res() res: express.Response, @Req() req) {
    const buffer = await this.service.generateCvByAi(prompt, req.user.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv-ai.pdf"',
    });
    res.send(buffer);
  }

  @Post('generate-template')
  async generateTemplate(@Body() body: any, @Res() res: express.Response, @Req() req) {
    const buffer = await this.service.generateCvFromTemplate(body.templateId, body.data, req.user.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv-template.pdf"',
    });
    res.send(buffer);
  }

  @Get('list')
  async list(@Req() req) {
    return this.service.getMyCvs(req.user.id);
  }

  @Patch('set-default/:id')
  async setDefault(@Param('id') id: number, @Req() req) {
    return this.service.setDefaultCv(id, req.user.id);
  }

  @Delete('delete/:id')
  async delete(@Param('id') id: number, @Req() req) {
    return this.service.softDeleteCv(id, req.user.id);
  }
}