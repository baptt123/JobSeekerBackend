import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { Repository } from 'typeorm';
import { GeminiService } from '../gemini/gemini.service';
import puppeteer from 'puppeteer';
import { CreateUserCvDto } from '../dto/create-cv.dto';

@Injectable()
export class GenerateCvService {
  constructor(
    @InjectRepository(UserCVEntity)
    private readonly cvRepository: Repository<UserCVEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(KeywordEntity)
    private readonly keywordRepository: Repository<KeywordEntity>,

    @InjectRepository(CVKeywordEntity)
    private readonly cvKeywordRepository: Repository<CVKeywordEntity>,

    private readonly geminiService: GeminiService,
  ) {}

  async exportCvPdf(prompt: string): Promise<Buffer> {
    const finalHtml = await this.geminiService.generateText(prompt);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    if (finalHtml) {
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

  async createCVWithKeywords(dto: CreateUserCvDto) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const user = await this.userRepository.findOne(dto.user_id);
    if (!user) throw new NotFoundException('User not found');

    const cv = this.cvRepository.create({
      user,
      title: dto.title,
      file_url: dto.file_url,
      content: dto.content,
      is_default: dto.is_default ?? false,
    });
    await this.cvRepository.save(cv);

    if (dto.keywords && dto.keywords.length > 0) {
      for (const kwName of dto.keywords) {
        let keyword = await this.keywordRepository.findOne({
          where: { keyword_name: kwName },
        });
        if (!keyword) {
          keyword = this.keywordRepository.create({ keyword_name: kwName });
          await this.keywordRepository.save(keyword);
        }

        const cvKeyword = this.cvKeywordRepository.create({
          cv,
          keyword,
        });
        await this.cvKeywordRepository.save(cvKeyword);
      }
    }

    return cv;
  }
}
