import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { Repository } from 'typeorm';
import { JobEntity } from '../entity/job.entity';
import { CreateUserCvDto } from '../dto/create-cv.dto';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GenerateCvService {
  private ai: GoogleGenAI;

  constructor(
    @InjectRepository(UserCVEntity)
    private readonly cvRepository: Repository<UserCVEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(KeywordEntity)
    private readonly keywordRepository: Repository<KeywordEntity>,
    @InjectRepository(CVKeywordEntity)
    private readonly cvKeywordRepository: Repository<CVKeywordEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async getCvHtml(prompt: string): Promise<string> {
    // Thêm console.log để xem prompt gửi đi
    console.log('[AI_DEBUG] Prompt gửi đi:', prompt);

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    // --- PHẦN DEBUG QUAN TRỌNG NHẤT ---
    // In toàn bộ nội dung response ra để kiểm tra
    console.log(
      '[AI_DEBUG] Response thô từ Google:',
      JSON.stringify(response, null, 2), // Dùng JSON.stringify để xem cấu trúc
    );

    // Lấy text
    const html = response.text?.trim();

    // In text đã được trim ra
    console.log('[AI_DEBUG] Text đã trích xuất:', html);
    // --- KẾT THÚC DEBUG ---

    if (!html || !html.startsWith('<!DOCTYPE html>')) {
      // Bạn có thể thêm nội dung lỗi vào đây để rõ hơn
      throw new Error('AI không trả về HTML hợp lệ. Nội dung trả về: ' + html);
    }
    return html;
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

  // async getJobsMatchingUserKeywords(userId: number) {
  //   // Lấy tất cả keywords của user
  //   const keywords = await this.cvKeywordRepository
  //     .createQueryBuilder('k')
  //     .innerJoin('k.cv', 'cv')
  //     .where('cv.user_id = :userId', { userId })
  //     .select('k.keyword')
  //     .getMany();
  //
  //   const keywordList = keywords.map((k) => k.keyword);
  //   if (keywordList.length === 0) return [];
  //
  //   // Tìm job có kỹ năng matching keyword
  //   return this.jobRepository
  //     .createQueryBuilder('job')
  //     .innerJoin('job.job_skills', 'js')
  //     .innerJoin('js.skill', 'skill')
  //     .where('skill.skill_name IN (:...keywordList)', { keywordList })
  //     .getMany();
  // }
  async saveCVAfterUpload(
    userId: number,
    file: Express.Multer.File,
    title: string,
    content: string,
    keywords: string[],
  ) {
    // Lưu bản CV
    const cv = this.cvRepository.create({
      user_id: userId,
      title,
      file_url: file.filename, // Nếu dùng Cloudinary thì thay bằng file.path hoặc secure_url
      content,
      is_default: false,
    });
    const savedCV = await this.cvRepository.save(cv);

    // Lưu keywords và mapping với CV
    const cvKeywordEntities: CVKeywordEntity[] = [];

    for (const k of keywords) {
      // Tìm hoặc tạo mới keyword
      let keyword = await this.keywordRepository.findOne({
        where: { keyword_name: k },
      });

      if (!keyword) {
        keyword = this.keywordRepository.create({ keyword_name: k });
        keyword = await this.keywordRepository.save(keyword);
      }

      // Tạo entity liên kết CV - Keyword
      const cvKeyword = this.cvKeywordRepository.create({
        cv: savedCV,
        keyword: keyword, // 🔥 gán quan hệ keyword vào đây
      });

      cvKeywordEntities.push(cvKeyword);
    }

    // Lưu các liên kết vào bảng cv_keywords
    await this.cvKeywordRepository.save(cvKeywordEntities);

    return {
      ...savedCV,
      keywords: keywords,
    };
  }
}
