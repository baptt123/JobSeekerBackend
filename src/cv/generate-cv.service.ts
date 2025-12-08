// src/cv/generate-cv.service.ts

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as handlebars from 'handlebars';

// Import Entities
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import { CreateCvDto } from '../dto/create-cv.dto';

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
  // 1. TẠO CV HTML TỪ PROMPT (AI - Tiếng Việt)
  // =================================================================
  async getCvHtml(userInfo: string): Promise<string> {
    const systemPrompt = `
      VAI TRÒ: Bạn là Chuyên gia Tư vấn Nghề nghiệp và Thiết kế CV hàng đầu Việt Nam.
      
      MỤC TIÊU: Biến đoạn văn bản đầu vào (dù sơ sài hay chi tiết) thành một bản CV HTML5 hoàn chỉnh, chuyên nghiệp và đẹp mắt.

      NHIỆM VỤ CỤ THỂ:
      1.  **Phân tích Input:** Xác định ngành nghề, cấp bậc (nếu có) từ văn bản người dùng.
      2.  **Xử lý thiếu thông tin (QUAN TRỌNG):**
          - Nếu người dùng nhập quá ít (VD: "tôi là dev", "làm cv marketing"):
            => HÃY TỰ ĐỘNG TẠO NỘI DUNG MẪU (Sample Content) phù hợp với ngành nghề đó.
            => Ví dụ: Nếu là Dev, hãy tự điền các kỹ năng như "Git, SQL, REST API" và mô tả công việc mẫu "Phát triển tính năng, tối ưu hiệu năng...".
          - Đối với thông tin cá nhân (Tên, Email, SĐT) bị thiếu:
            => Dùng Placeholder rõ ràng: "[Điền Họ Tên]", "[Số điện thoại]", "[Email liên hệ]".
            => KHÔNG tự bịa ra thông tin liên lạc ảo.
      3.  **Thiết kế & Format:**
          - Layout 2 cột hiện đại (Sidebar trái + Content phải).
          - Tông màu: Xanh Navy (#2c3e50) & Trắng, Font chữ Sans-serif (Arial/Helvetica).
          - Sử dụng CSS nội bộ (<style>) để căn chỉnh đẹp mắt trên khổ A4.
      
      CẤU TRÚC HTML YÊU CẦU:
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
           /* CSS chuẩn cho A4 */
           body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #333; }
           .container { display: flex; min-height: 100vh; }
           .left-col { width: 30%; background: #f4f6f8; padding: 30px 20px; color: #2c3e50; }
           .right-col { width: 70%; padding: 40px 30px; }
           h1 { margin: 0 0 10px; font-size: 28px; text-transform: uppercase; color: #2c3e50; }
           h2 { font-size: 18px; color: #3498db; margin-bottom: 20px; font-weight: 500; }
           h3 { border-bottom: 2px solid #2c3e50; padding-bottom: 5px; margin-top: 30px; text-transform: uppercase; font-size: 16px; letter-spacing: 1px; }
           .info-item { margin-bottom: 10px; font-size: 14px; }
           .skill-tag { display: inline-block; background: #e1e8ed; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin: 0 5px 5px 0; }
           .exp-item { margin-bottom: 20px; }
           .exp-title { font-weight: bold; font-size: 16px; }
           .exp-company { font-style: italic; color: #555; font-size: 14px; margin-bottom: 5px; }
           .exp-desc { font-size: 14px; line-height: 1.5; text-align: justify; }
        </style>
      </head>
      <body>
         </body>
      </html>

      ĐẦU RA:
      - Chỉ trả về chuỗi HTML thuần.
      - KHÔNG bọc trong markdown (\`\`\`).

      INPUT CỦA NGƯỜI DÙNG:
      "${userInfo}"
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      });

      let html = response.text?.trim();

      // Clean markdown nếu có
      if (html?.startsWith('```')) {
        html = html
          .replace(/^```html/, '')
          .replace(/^```/, '')
          .replace(/```$/, '')
          .trim();
      }

      return (
        html ||
        '<html><body><h1>Không thể tạo CV. Vui lòng thử lại với mô tả chi tiết hơn.</h1></body></html>'
      );
    } catch (error) {
      this.logger.error('Error generating CV HTML:', error);
      throw new InternalServerErrorException('AI Service không phản hồi.');
    }
  }
  // =================================================================
  // 3. TRÍCH XUẤT TEXT TỪ PDF (Scan)
  // =================================================================
  async extractTextFromPdf(file: Express.Multer.File): Promise<string> {
    try {
      const base64Data = file.buffer.toString('base64');
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Trích xuất toàn bộ văn bản từ file PDF này. Chỉ trả về kết quả là text thuần.',
              },
              { inlineData: { mimeType: file.mimetype, data: base64Data } },
            ],
          },
        ],
      });
      return response.text?.trim() || '';
    } catch (error) {
      this.logger.error('Error extracting text:', error);
      throw new InternalServerErrorException('Lỗi khi đọc tài liệu PDF.');
    }
  }

  // =================================================================
  // 4. PHÂN TÍCH KEYWORDS (Dùng cho Search/Filter)
  // =================================================================
  async analyzeAndExtractKeywords(text: string): Promise<string[]> {
    try {
      const prompt = `Extract top 15 technical keywords (skills, tools) from this CV text as a JSON array (e.g. ["Java", "Spring Boot"]). Text: ${text.substring(0, 5000)}`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const cleanText = result.text?.replace(/```json|```/g, '').trim() || '[]';
      return JSON.parse(cleanText) as string[];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.logger.warn('Keyword extraction failed, returning empty list.');
      return [];
    }
  }

  // =================================================================
  // 5. XỬ LÝ SCAN CV TOÀN DIỆN (Scan -> Upload -> Save)
  // =================================================================
  async processScanCV(file: Express.Multer.File, userId: number) {
    // B1: SCAN TEXT
    let extractedText = '';
    try {
      extractedText = await this.extractTextFromPdf(file);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new BadRequestException('Không thể đọc nội dung file PDF.');
    }

    if (!extractedText || extractedText.length < 50) {
      throw new BadRequestException(
        'File PDF không chứa văn bản đọc được hoặc quá ngắn.',
      );
    }

    // B2: UPLOAD CLOUDINARY
    let fileUrl = '';
    try {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      if (!uploadResult || !('secure_url' in uploadResult)) {
        throw new Error('Cloudinary response invalid');
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      fileUrl = uploadResult.secure_url || uploadResult.url;
    } catch (e) {
      this.logger.error('Upload failed:', e);
      throw new InternalServerErrorException('Lỗi khi lưu file lên Cloud.');
    }

    // B3: LƯU DB
    try {
      const newCV = this.cvRepository.create({
        user_id: userId,
        title: file.originalname,
        file_url: fileUrl,
        content: extractedText,
        is_default: false,
      });

      const count = await this.cvRepository.count({
        where: { user_id: userId },
      });
      if (count === 0) newCV.is_default = true;

      const savedCV = await this.cvRepository.save(newCV);

      // B4: TRÍCH XUẤT KEYWORD (Chạy ngầm)
      this.analyzeAndExtractKeywords(extractedText).then(async (keywords) => {
        for (const word of keywords) {
          let keywordEnt = await this.keywordRepository.findOneBy({
            keyword_name: word,
          });
          if (!keywordEnt) {
            keywordEnt = await this.keywordRepository.save(
              this.keywordRepository.create({ keyword_name: word }),
            );
          }
          await this.cvKeywordRepository.save({
            cv: savedCV,
            keyword: keywordEnt,
          });
        }
      });

      return {
        message: 'Phân tích và lưu CV thành công!',
        data: {
          cvId: savedCV.cv_id,
          fileUrl: savedCV.file_url,
          title: savedCV.title,
        },
      };
    } catch (e) {
      this.logger.error('Database save error:', e);
      throw new InternalServerErrorException('Lỗi khi lưu thông tin CV.');
    }
  }

  // =================================================================
  // 6. QUẢN LÝ CV (CRUD)
  // =================================================================
  async getMyCvs(userId: number): Promise<UserCVEntity[]> {
    return await this.cvRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async setDefaultCv(userId: number, cvId: number): Promise<void> {
    const cv = await this.cvRepository.findOneBy({
      cv_id: cvId,
      user_id: userId,
    });
    if (!cv) throw new NotFoundException('CV không tồn tại');
    await this.cvRepository.update({ user_id: userId }, { is_default: false });
    await this.cvRepository.update({ cv_id: cvId }, { is_default: true });
  }

  async deleteCv(userId: number, cvId: number): Promise<void> {
    const cv = await this.cvRepository.findOneBy({
      cv_id: cvId,
      user_id: userId,
    });
    if (!cv) throw new NotFoundException('CV không tồn tại');
    await this.cvRepository.delete({ cv_id: cvId });
  }

  // Upload CV thủ công (không cần scan AI)
  async uploadCvSimple(
    file: Express.Multer.File,
    userId: number,
    title?: string,
  ) {
    const uploadResult = await this.cloudinaryService.uploadFile(file);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fileUrl = uploadResult.secure_url || uploadResult.url;

    const newCV = this.cvRepository.create({
      user_id: userId,
      title: title || file.originalname,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      file_url: fileUrl,
      content: '',
      is_default: false,
    });

    const count = await this.cvRepository.count({ where: { user_id: userId } });
    if (count === 0) newCV.is_default = true;

    return await this.cvRepository.save(newCV);
  }

  // 1. Hàm Compile HTML từ Template Handlebars
  async compileTemplate(
    templateId: string,
    data: CreateCvDto,
  ): Promise<string> {
    try {
      // Chọn file dựa trên ID
      let templateName = 'cv_template_1.hbs';
      if (templateId === '2') templateName = 'cv_template_2.hbs';

      const filePath = path.join(process.cwd(), 'views', templateName);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Template file not found: ${filePath}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const source = await fs.readFile(filePath, 'utf8');
      const template = handlebars.compile(source);

      // Helper format ngày tháng nếu cần
      handlebars.registerHelper('formatDate', (dateString) => {
        return new Date(dateString).toLocaleDateString('vi-VN');
      });

      // Truyền dữ liệu vào template
      return template({ cv: data });
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Lỗi khi tạo giao diện CV');
    }
  }

  // 2. Tạo PDF Buffer từ HTML
  async generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
    let browser;
    try {
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const page = await browser.newPage();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdfBuffer);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      if (browser) await browser.close();
    }
  }

  // 3. Quy trình Đầy đủ: Tạo -> Upload -> Lưu DB
  async generateAndSaveCvFromTemplate(
    userId: number,
    templateId: string,
    dto: CreateCvDto,
  ): Promise<UserCVEntity> {
    // B1: Tạo HTML & PDF
    const html = await this.compileTemplate(templateId, dto);
    const pdfBuffer = await this.generatePdfFromHtml(html);

    // B2: Upload lên Cloudinary (Dùng stream)
    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream =
        this.cloudinaryService.cloudinary.uploader.upload_stream(
          { folder: 'generated_cvs', resource_type: 'auto', format: 'pdf' },
          (error, result) => {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            if (error) reject(error);
            else resolve(result);
          },
        );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-require-imports
      const stream = require('stream');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const bufferStream = new stream.PassThrough();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      bufferStream.end(pdfBuffer);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      bufferStream.pipe(uploadStream);
    });

    // B3: Lưu vào Database
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const fileUrl = uploadResult.secure_url;

    // Kiểm tra nếu chưa có CV nào thì set default
    const count = await this.cvRepository.count({ where: { user_id: userId } });

    const newCV = this.cvRepository.create({
      user_id: userId,
      title: `CV ${dto.jobTitle || 'Mới'}`,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      file_url: fileUrl,
      is_default: count === 0,
      content: JSON.stringify(dto), // Lưu lại data gốc để sau này chỉnh sửa (nếu cần)
    });

    return await this.cvRepository.save(newCV);
  }
}
