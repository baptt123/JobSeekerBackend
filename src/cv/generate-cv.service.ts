import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';

// Import Entities
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { JobEntity } from '../entity/job.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';

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
    private readonly cloudinaryService: CloudinaryCustomService,
  ) {
    // Khởi tạo Gemini Client
    // Đảm bảo bạn đã cài đặt thư viện: npm install @google/genai
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // =================================================================
  // 1. TẠO CV HTML TỪ PROMPT NGƯỜI DÙNG
  // =================================================================
  async getCvHtml(userPrompt: string): Promise<string> {
    const finalPrompt = `
## MỤC TIÊU CUỐI CÙNG ##
Tạo một tài liệu HTML CV chuyên nghiệp, đầy đủ nội dung.

## BƯỚC 1: PHÂN TÍCH YÊU CẦU NGƯỜI DÙNG ##
Đây là những gì người dùng muốn: "${userPrompt}"

## BƯỚC 2: HƯỚNG DẪN TẠO CV ##
1. Rút trích kỹ năng, kinh nghiệm, học vấn từ yêu cầu.
2. **QUAN TRỌNG:** Nếu thông tin quá ít (ví dụ: "làm cv cho tôi"), BẠN PHẢI TỰ ĐỘNG BỊA RA một vai trò mặc định (ví dụ: "Backend Developer Node.js") và điền đầy đủ nội dung mẫu chuyên nghiệp.
3. Mục tiêu: LUÔN LUÔN trả về HTML đầy đủ, không bao giờ báo lỗi thiếu thông tin.
4. Font chữ: Arial, Helvetica, sans-serif.

## BƯỚC 3: YÊU CẦU ĐỊNH DẠNG (NGHIÊM NGẶT) ##
1. CHỈ trả về mã HTML thô (raw HTML).
2. KHÔNG viết gì thêm trước <!DOCTYPE html> hoặc sau </html>.
3. KHÔNG dùng Markdown (\`\`\`html).
4. CSS phải nằm trong thẻ <style> bên trong <head>.
`;

    console.log('[GenerateCV] Prompt sent:', finalPrompt);

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash', // Dùng Flash cho nhanh và rẻ
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      });

      let html = response.text?.trim();

      // Clean markdown nếu Gemini lỡ trả về
      if (html?.startsWith('```html')) {
        html = html
          .replace(/^```html/, '')
          .replace(/```$/, '')
          .trim();
      }

      if (
        !html ||
        !html.toLowerCase().startsWith('<!doctype html>') ||
        !html.toLowerCase().endsWith('</html>')
      ) {
        throw new Error('AI trả về HTML không hợp lệ.');
      }

      return html;
    } catch (error) {
      console.error('[GenerateCV] Error:', error);
      throw new InternalServerErrorException('Không thể tạo CV lúc này.');
    }
  }

  // =================================================================
  // 2. TRÍCH XUẤT TEXT TỪ FILE PDF (QUAN TRỌNG: ĐÃ THÊM MỚI)
  // =================================================================
  async extractTextFromPdf(
    file: Express.Multer.File,
  ): Promise<{ extractedText: string; fileName: string }> {
    console.log(`[ExtractText] Đang xử lý file: ${file.originalname}`);

    try {
      // Chuyển buffer sang base64 để gửi inline (Gọn nhẹ, không cần file tạm)
      const base64Data = file.buffer.toString('base64');

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', // Flash hỗ trợ đọc tài liệu rất tốt
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Trích xuất toàn bộ văn bản thô (raw text) từ tài liệu PDF này. Chỉ trả về văn bản, không tóm tắt, không chú thích.',
              },
              {
                inlineData: {
                  mimeType: file.mimetype, // 'application/pdf'
                  data: base64Data,
                },
              },
            ],
          },
        ],
      });

      const extractedText = response.text?.trim() || '';
      console.log(`[ExtractText] Đã trích xuất ${extractedText.length} ký tự.`);

      return {
        extractedText,
        fileName: file.originalname,
      };
    } catch (error) {
      console.error('[ExtractText] Lỗi:', error);
      throw new InternalServerErrorException('Lỗi khi đọc file PDF.');
    }
  }

  // =================================================================
  // 3. PHÂN TÍCH KEYWORDS TỪ TEXT
  // =================================================================
  async analyzeAndExtractKeywords(text: string): Promise<string[]> {
    try {
      const prompt = `
        Phân tích văn bản CV dưới đây và trích xuất các từ khóa quan trọng:
        - Kỹ năng (Languages, Tools, Frameworks)
        - Vị trí (Job titles)
        - Chứng chỉ (Certifications)
        
        Output JSON Array only (e.g. ["Java", "ReactJS"]). No markdown.
        
        CV Text:
        ${text.substring(0, 10000)} // Cắt bớt nếu quá dài để tiết kiệm token
      `;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const responseText = result.text?.trim() || '[]';
      const cleanedText = responseText.replace(/```json|```/g, '').trim();

      return JSON.parse(cleanedText) as string[];
    } catch (error) {
      console.error('[AnalyzeKeywords] Lỗi:', error);
      return [];
    }
  }

  // =================================================================
  // 4. LƯU CV VÀ MAP KEYWORDS VÀO DB
  // =================================================================
  async saveCVAndKeywords(
    userId: number,
    fileName: string,
    fileUrl: string,
    extractedText: string,
  ): Promise<UserCVEntity> {
    // 1. Lưu CV
    const newCV = this.cvRepository.create({
      user_id: userId,
      title: fileName,
      file_url: fileUrl,
      content: extractedText,
      is_default: false,
    });

    const savedCV = await this.cvRepository.save(newCV);
    console.log(`[DB] Saved CV ID: ${savedCV.cv_id}`);

    // 2. Lấy Keywords
    const keywords = await this.analyzeAndExtractKeywords(extractedText);
    console.log(`[AI] Found keywords: ${keywords.length}`);

    // 3. Lưu Keywords & Relations
    for (const word of keywords) {
      const cleanWord = word.trim();
      if (!cleanWord) continue;

      // Upsert Keyword
      let keywordEntity = await this.keywordRepository.findOne({
        where: { keyword_name: cleanWord },
      });

      if (!keywordEntity) {
        keywordEntity = await this.keywordRepository.save(
          this.keywordRepository.create({ keyword_name: cleanWord }),
        );
      }

      // Check relation duplication
      const existingLink = await this.cvKeywordRepository.findOne({
        where: {
          cv: { cv_id: savedCV.cv_id },
          keyword: { keyword_id: keywordEntity.keyword_id },
        },
        relations: ['cv', 'keyword'], // Quan trọng để load relation ID
      });

      if (!existingLink) {
        await this.cvKeywordRepository.save(
          this.cvKeywordRepository.create({
            cv: savedCV,
            keyword: keywordEntity,
          }),
        );
      }
    }

    return savedCV;
  }

  // =================================================================
  // ⭐️ MAIN FLOW: ĐÃ TÍCH HỢP CLOUDINARY
  // =================================================================
  async processFullCV(file: Express.Multer.File, userId: number) {
    try {
      // 1. Trích xuất Text
      const { extractedText, fileName } = await this.extractTextFromPdf(file);

      // 2. Upload Cloudinary
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const realFileUrl = uploadResult.secure_url || uploadResult.url;

      // 3. Lưu DB
      const savedCV = await this.saveCVAndKeywords(
        userId,
        fileName,
        realFileUrl,
        extractedText,
      );

      // ⭐️ SỬA ĐOẠN RETURN NÀY:
      return {
        message: 'Xử lý và lưu CV thành công',
        cv_id: savedCV.cv_id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        file_url: realFileUrl,
        extracted_text: extractedText, // 👈 THÊM DÒNG NÀY ĐỂ TRẢ VỀ TEXT CHO FRONTEND
      };
    } catch (error) {
      console.error('Lỗi quy trình xử lý CV:', error);
      throw new InternalServerErrorException('Có lỗi xảy ra khi xử lý CV.');
    }
  }
}
