import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { LogEntity } from '../entity/log.entity';
import { UserEntity } from '../entity/user.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';

// Import GoogleGenAI SDK
const { GoogleGenAI } = require('@google/genai');

@Injectable()
export class GenerateCvService {
  private ai: any;

  constructor(
    @InjectRepository(UserCVEntity)
    private userCvRepo: Repository<UserCVEntity>,
    @InjectRepository(LogEntity)
    private logRepo: Repository<LogEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private cloudinaryService: CloudinaryCustomService,
    private dataSource: DataSource,
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // --- 1. UPLOAD CV VÀ RÚT TRÍCH KEYWORD (GIỮ NGUYÊN) ---
  async uploadAndExtractKeywords(file: Express.Multer.File, userId: number) {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Định dạng file không hợp lệ. Chỉ chấp nhận file PDF.');
    }

    let uploadRes;
    try {
      uploadRes = await this.cloudinaryService.uploadFile(file);
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khi upload file lên Cloudinary: ' + e.message);
    }

    let extractedKeywords = "chưa xác định";
    const tempFilePath = path.join(process.cwd(), `temp-${userId}-${Date.now()}.pdf`);

    try {
      fs.writeFileSync(tempFilePath, file.buffer);

      const fileSearchStore = await this.ai.fileSearchStores.create({
        config: { displayName: `cv_extraction_${userId}_${Date.now()}` }
      });

      let operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
        file: tempFilePath,
        fileSearchStoreName: fileSearchStore.name,
        config: { displayName: file.originalname }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        operation = await this.ai.operations.get({ operation });
      }

      const model = this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hãy phân tích file CV này và liệt kê các kỹ năng chuyên môn (technical skills). Chỉ trả về danh sách các từ khoá cách nhau bởi dấu phẩy, không thêm lời dẫn.",
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [fileSearchStore.name] } }]
        }
      });

      const response = await model;
      if (response.text) {
        extractedKeywords = response.text.trim();
      }

      await this.ai.fileSearchStores.delete({ name: fileSearchStore.name });

    } catch (error) {
      console.error("Gemini Extraction Error:", error);
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    try {
      const newCV = this.userCvRepo.create({
        user_id: userId,
        file_url: uploadRes.url,
        title: file.originalname,
        content: extractedKeywords,
        is_default: false,
        is_deleted: false
      });
      const savedCV = await this.userCvRepo.save(newCV);

      await this.logRepo.save({
        action: 'UPLOAD_CV',
        details: `Người dùng ${userId} đã tải lên CV ${savedCV.cv_id}. Keywords: ${extractedKeywords}`,
        user: { user_id: userId } as UserEntity,
      });

      return { message: "Tải lên thành công", cv: savedCV, keywords: extractedKeywords };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khi lưu CV vào DB: ' + e.message);
    }
  }

  // --- 2. TẠO CV BẰNG GEMINI API (FIX LỖI FORMAT & TIMEOUT) ---
  async generateCvByAi(promptUser: string, userId: number) {
    if (!promptUser) throw new BadRequestException('Vui lòng nhập nội dung mô tả cho CV.');

    // Prompt nghiêm ngặt để tránh Markdown
    const systemPrompt = `
      Bạn là chuyên gia thiết kế CV. Dựa trên mô tả: "${promptUser}".
      Hãy tạo mã HTML5 đầy đủ (kèm CSS inline) cho một CV chuyên nghiệp.
      
      YÊU CẦU QUAN TRỌNG:
      1. OUTPUT PHẢI LÀ MÃ HTML THUẦN. KHÔNG được bọc trong \`\`\`html hay bất kỳ Markdown nào.
      2. KHÔNG trả về lời dẫn, chỉ trả về code.
      3. CV PHẢI có thẻ <img src="[https://via.placeholder.com/150](https://via.placeholder.com/150)" alt="Avatar" style="border-radius:50%; width:100px; height:100px; margin-bottom:10px;">.
      4. Sử dụng font chữ Unicode (Arial, Roboto) để hỗ trợ tiếng Việt.
      5. Nếu thiếu thông tin (Kinh nghiệm, Học vấn), HÃY TỰ ĐIỀN DỮ LIỆU GIẢ LẬP HỢP LÝ.
    `;

    let htmlContent = "";
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt
      });

      // CLEAN RESPONE: Loại bỏ markdown nếu Gemini vẫn cố tình trả về
      htmlContent = response.text || "";
      htmlContent = htmlContent.replace(/```html/g, '').replace(/```/g, '').trim();

      if (!htmlContent.startsWith('<')) {
        // Fallback nếu output bị lỗi
        throw new Error("AI trả về định dạng không hợp lệ.");
      }

      // Generate PDF bằng Puppeteer
      const pdfBuffer = await this.createPdfFromHtml(htmlContent);

      await this.logRepo.save({
        action: 'GENERATE_CV_AI',
        details: `Người dùng ${userId} tạo CV AI. Prompt: ${promptUser.substring(0, 20)}...`,
        user: { user_id: userId } as UserEntity,
      });

      return pdfBuffer;

    } catch (e) {
      console.error("AI Gen Error:", e);
      throw new InternalServerErrorException('Lỗi tạo CV AI: ' + e.message);
    }
  }

  // --- 3. TẠO CV TỪ TEMPLATE (FIX LỖI ĐƯỜNG DẪN & DATA) ---
  async generateCvFromTemplate(templateId: number, data: any, userId: number) {
    // 1. Validation
    if (!data.fullName) throw new BadRequestException("Thiếu thông tin họ tên.");

    try {
      // 2. Xác định đường dẫn file Template (Tuyệt đối hóa đường dẫn)
      const templateFileName = templateId === 1 ? 'cv_template_1.hbs' : 'cv_template_2.hbs';
      // LƯU Ý: process.cwd() trả về thư mục gốc dự án. Thư mục views phải nằm ở gốc.
      const templatePath = path.join(process.cwd(), 'views', templateFileName);

      if (!fs.existsSync(templatePath)) {
        throw new NotFoundException(`Không tìm thấy file template tại: ${templatePath}`);
      }

      // 3. Đọc và Compile Template
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);

      // 4. Wrap data vào object 'cv' vì trong template dùng {{cv.fullName}}
      const context = { cv: data };

      const htmlContent = template(context);

      // 5. Generate PDF
      const pdfBuffer = await this.createPdfFromHtml(htmlContent);

      await this.logRepo.save({
        action: 'GENERATE_CV_TEMPLATE',
        details: `Người dùng ${userId} tạo CV từ Template ${templateId}`,
        user: { user_id: userId } as UserEntity,
      });

      return pdfBuffer;

    } catch (e) {
      console.error("Template Gen Error:", e);
      throw new InternalServerErrorException('Lỗi tạo CV Template: ' + e.message);
    }
  }

  // --- HELPER: PUPPETEER PDF ---
  private async createPdfFromHtml(html: string): Promise<Buffer> {
    // Cấu hình --no-sandbox để chạy được trên server/docker
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set content và chờ load xong
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  // --- 4. QUẢN LÝ CV (GIỮ NGUYÊN) ---
  async getMyCvs(userId: number) {
    return this.userCvRepo.find({
      where: { user_id: userId, is_deleted: false },
      order: { is_default: 'DESC', created_at: 'DESC' }
    });
  }

  async softDeleteCv(cvId: number, userId: number) {
    const cv = await this.userCvRepo.findOne({ where: { cv_id: cvId, user_id: userId, is_deleted: false } });
    if (!cv) throw new NotFoundException('CV không tồn tại.');

    cv.is_deleted = true;
    cv.deleted_at = new Date();
    if (cv.is_default) cv.is_default = false;

    await this.userCvRepo.save(cv);
    return { message: 'Đã xóa CV thành công.' };
  }

  async setDefaultCv(cvId: number, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cv = await queryRunner.manager.findOne(UserCVEntity, { where: { cv_id: cvId, user_id: userId, is_deleted: false } });
      if (!cv) throw new NotFoundException('CV không tìm thấy.');

      await queryRunner.manager.update(UserCVEntity, { user_id: userId }, { is_default: false });
      await queryRunner.manager.update(UserCVEntity, { cv_id: cvId }, { is_default: true });

      await queryRunner.manager.save(LogEntity, {
        action: 'SET_DEFAULT_CV',
        details: `Người dùng ${userId} đặt CV ${cvId} làm mặc định.`,
        user: { user_id: userId },
      });

      await queryRunner.commitTransaction();
      return { message: 'Đã đặt làm CV mặc định.' };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Lỗi giao dịch: ' + e.message);
    } finally {
      await queryRunner.release();
    }
  }
}