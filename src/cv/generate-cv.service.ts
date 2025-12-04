import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import * as puppeteer from 'puppeteer'; // Import Puppeteer

// Import Entities
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';

@Injectable()
export class GenerateCvService {
  private ai: GoogleGenAI;
  private readonly logger = new Logger(GenerateCvService.name);

  constructor(
    @InjectRepository(UserCVEntity)
    private readonly cvRepository: Repository<UserCVEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(KeywordEntity)
    private readonly keywordRepository: Repository<KeywordEntity>,
    @InjectRepository(CVKeywordEntity)
    private readonly cvKeywordRepository: Repository<CVKeywordEntity>,
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // =================================================================
  // 1. TẠO CV HTML TỪ PROMPT (AI)
  // =================================================================
  async getCvHtml(userPrompt: string): Promise<string> {
    const finalPrompt = `
      ## MỤC TIÊU ##
      Tạo CV HTML chuyên nghiệp dựa trên: "${userPrompt}".
      
      ## YÊU CẦU KỸ THUẬT ##
      1. Trả về raw HTML (<!DOCTYPE html>...</html>).
      2. CSS in-line hoặc trong thẻ <style>.
      3. Font chữ: Arial, sans-serif.
      4. Bố cục: Header (Tên, Job Title), Cột trái (Thông tin, Skill), Cột phải (Kinh nghiệm, Học vấn).
      5. KHÔNG dùng Markdown block (\`\`\`html).
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      });

      let html = response.text?.trim();

      // Clean markdown
      if (html?.startsWith('```html')) {
        html = html
          .replace(/^```html/, '')
          .replace(/```$/, '')
          .trim();
      }

      return html || '';
    } catch (error) {
      this.logger.error('Error generating CV HTML:', error);
      throw new InternalServerErrorException('AI Service không phản hồi.');
    }
  }

  // =================================================================
  // [MỚI] 2. GENERATE PDF TỪ HTML (Logic dùng chung)
  // =================================================================
  async generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
    let browser;
    try {
      this.logger.log('Launching Puppeteer...');
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
        headless: true,
      });

      const page = await browser.newPage();

      // Thêm style mặc định để đảm bảo hiển thị đẹp
      const finalHtml = `
        <style>body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; }</style>
        ${htmlContent}
      `;

      await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true, // In cả màu nền
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Error rendering PDF:', error);
      throw new InternalServerErrorException('Lỗi khi tạo file PDF.');
    } finally {
      if (browser) await browser.close();
    }
  }

  // =================================================================
  // 3. TRÍCH XUẤT TEXT TỪ FILE PDF
  // =================================================================
  async extractTextFromPdf(file: Express.Multer.File): Promise<string> {
    try {
      const base64Data = file.buffer.toString('base64');
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash', // Flash đủ tốt cho task này
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Trích xuất toàn bộ text từ tài liệu này. Chỉ trả về text.',
              },
              { inlineData: { mimeType: file.mimetype, data: base64Data } },
            ],
          },
        ],
      });
      return response.text?.trim() || '';
    } catch (error) {
      this.logger.error('Error extracting text:', error);
      throw new InternalServerErrorException('Lỗi khi đọc tài liệu.');
    }
  }

  // =================================================================
  // 4. PHÂN TÍCH KEYWORDS
  // =================================================================
  async analyzeAndExtractKeywords(text: string): Promise<string[]> {
    try {
      // Prompt ngắn gọn hơn để tiết kiệm token và tăng tốc độ
      const prompt = `Extract top 15 technical keywords (skills, tools, frameworks) from this CV text as a JSON array (e.g. ["Java", "Spring Boot"]). Text: ${text.substring(0, 5000)}`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const cleanText = result.text?.replace(/```json|```/g, '').trim() || '[]';
      return JSON.parse(cleanText) as string[];
    } catch (error) {
      this.logger.warn('Keyword extraction failed, returning empty list.');
      return [];
    }
  }

  // =================================================================
  // 5. XỬ LÝ SCAN PDF TOÀN DIỆN (Upload -> Save -> Extract)
  // =================================================================
  async processScanCV(file: Express.Multer.File, userId: number) {
    // 1. Upload Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(file);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fileUrl = uploadResult.secure_url || uploadResult.url;

    // 2. Trích xuất Text (Song song với việc lưu DB để tối ưu nếu cần, nhưng tuần tự an toàn hơn)
    const extractedText = await this.extractTextFromPdf(file);

    // 3. Lưu vào DB (Tạo bản ghi CV mới)
    const newCV = this.cvRepository.create({
      user_id: userId,
      title: file.originalname, // Tên file gốc
      file_url: fileUrl,
      content: extractedText,
      is_default: false, // Mặc định chưa set làm CV chính
    });
    const savedCV = await this.cvRepository.save(newCV);

    // 4. Trích xuất & Lưu Keywords (Chạy background hoặc await luôn tùy nhu cầu)
    // Ở đây await luôn để đảm bảo dữ liệu đồng bộ
    const keywords = await this.analyzeAndExtractKeywords(extractedText);

    // Lưu Keywords
    for (const word of keywords) {
      let keywordEnt = await this.keywordRepository.findOneBy({
        keyword_name: word,
      });
      if (!keywordEnt) {
        keywordEnt = await this.keywordRepository.save(
          this.keywordRepository.create({ keyword_name: word }),
        );
      }
      // Tạo liên kết
      await this.cvKeywordRepository.save({
        cv: savedCV,
        keyword: keywordEnt,
      });
    }

    return {
      message: 'CV uploaded and processed successfully',
      cv_id: savedCV.cv_id,
      file_url: fileUrl,
      extracted_text: extractedText,
      keywords: keywords,
    };
  }
}
