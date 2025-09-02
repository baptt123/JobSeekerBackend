import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { Repository } from 'typeorm';
import { GeminiService } from '../gemini/gemini.service';
import puppeteer from 'puppeteer';

@Injectable()
export class GenerateCvService {
  constructor(
    @InjectRepository(UserCVEntity)
    private readonly cvRepository: Repository<UserCVEntity>,
    private readonly geminiService: GeminiService,
  ) {}
  async exportCvPdf(prompt: string): Promise<Buffer> {
    // Lấy nội dung HTML từ Gemini
    // Nếu có dùng template handlebars thì compile, còn không thì dùng luôn htmlContent
    // const template = handlebars.compile(htmlContent);
    // const finalHtml = template({ /* bất kỳ data cần truyền */ });
    const finalHtml = await this.geminiService.generateText(prompt);

    // Đưa vào puppeteer sinh PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    if (finalHtml != null) {
      await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    }
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    await browser.close();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return pdfBuffer;
  }
}
