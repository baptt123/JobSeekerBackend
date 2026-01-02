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
import { CreateCvDto } from '../dto/create-cv.dto';

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
    private userRepo: Repository<UserEntity>, // Inject User Repo để lấy avatar
    private cloudinaryService: CloudinaryCustomService,
    private dataSource: DataSource,
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // --- HELPER: GHI LOG HỆ THỐNG ---
  private async logStep(userId: number, action: string, message: string) {
    console.log(`[SV-LOG] User:${userId} | Action:${action} | ${message}`);
    try {
      await this.logRepo.save({
        action: action,
        details: message,
        user: { user_id: userId } as UserEntity,
      });
    } catch (err) {
      console.error('Lỗi khi ghi log vào DB:', err);
    }
  }

  // --- 1. UPLOAD CV (GIỮ NGUYÊN) ---
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

    const extractedKeywords = "Kỹ năng được rút trích từ PDF (Placeholder)";

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
        details: `Người dùng ${userId} đã tải lên CV ${savedCV.cv_id}.`,
        user: { user_id: userId } as UserEntity,
      });

      return { message: "Tải lên thành công", cv: savedCV, keywords: extractedKeywords };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khi lưu CV vào DB: ' + e.message);
    }
  }

  // --- 2. TẠO CV BẰNG GEMINI API (GIỮ NGUYÊN) ---
  async generateCvByAi(promptUser: string, userId: number) {
    const actionTag = 'GENERATE_CV_AI';

    if (!promptUser) throw new BadRequestException('Vui lòng nhập nội dung mô tả cho CV.');
    await this.logStep(userId, actionTag, `Bắt đầu quy trình tạo CV. Prompt gốc: ${promptUser.substring(0, 50)}...`);

    const systemPrompt = `
      Đóng vai chuyên gia thiết kế CV chuyên nghiệp.
      Nhiệm vụ: Dựa trên mô tả "${promptUser}", hãy viết mã HTML5 và CSS (inline-css) đầy đủ để tạo ra một bản CV đẹp mắt.
      YÊU CẦU KỸ THUẬT NGHIÊM NGẶT:
      1. OUTPUT: Chỉ trả về mã nguồn HTML thuần túy. KHÔNG bọc trong markdown.
      2. ẢNH ĐẠI DIỆN: Chèn link ảnh placeholder hợp lý.
      3. FONT CHỮ: 'Arial', 'Roboto' hỗ trợ Tiếng Việt.
    `;

    let htmlContent = "";

    try {
      await this.logStep(userId, actionTag, 'Đang gửi yêu cầu đến Gemini API...');
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt
      });

      await this.logStep(userId, actionTag, 'Đã nhận phản hồi từ Gemini. Đang xử lý HTML...');
      htmlContent = response.text || "";
      htmlContent = htmlContent.replace(/```html/g, '').replace(/```/g, '').trim();

      if (!htmlContent.startsWith('<') || htmlContent.length < 50) {
        throw new Error("AI trả về dữ liệu không đúng định dạng HTML.");
      }

      await this.logStep(userId, actionTag, 'Đang render file PDF từ HTML...');
      const pdfBuffer = await this.createPdfFromHtml(htmlContent);

      await this.logStep(userId, actionTag, `Thành công. Kích thước file PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB.`);
      return pdfBuffer;

    } catch (e) {
      const errorMsg = `Lỗi quy trình tạo CV AI: ${e.message}`;
      console.error(errorMsg);
      await this.logStep(userId, 'GENERATE_CV_ERROR', errorMsg);
      throw new InternalServerErrorException('Đã xảy ra lỗi trong quá trình tạo CV AI. Vui lòng thử lại.');
    }
  }

  // --- 3. TẠO CV TỪ TEMPLATE (NÂNG CẤP) ---
  async generateCvFromTemplate(templateId: number, data: CreateCvDto, userId: number) {
    const actionTag = 'GENERATE_CV_TEMPLATE';
    await this.logStep(userId, actionTag, `Bắt đầu tạo CV từ Template ${templateId}.`);

    try {
      // B1: Lấy thông tin User để lấy Avatar
      const user = await this.userRepo.findOne({ where: { user_id: userId } });
      if (!user) throw new NotFoundException('Không tìm thấy thông tin người dùng.');

      // Xử lý Avatar: Nếu user chưa có avatar_url thì dùng ảnh placeholder theo tên
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=random&size=200`;
      const userAvatar = (user.avatar_url && user.avatar_url.trim() !== '') ? user.avatar_url : defaultAvatar;

      await this.logStep(userId, actionTag, `Sử dụng avatar: ${userAvatar}`);

      // B2: Chuẩn bị template path
      const templateFileName = templateId === 2 ? 'cv_template_2.hbs' : 'cv_template_1.hbs';
      const templatePath = path.join(process.cwd(), 'views', templateFileName);

      if (!fs.existsSync(templatePath)) {
        throw new NotFoundException(`Không tìm thấy file mẫu: ${templateFileName}`);
      }

      // B3: Đọc và Compile Handlebars
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);

      // Mapping dữ liệu: data từ frontend + avatar từ DB
      const context = {
        cv: {
          ...data,
          avatar: userAvatar
        }
      };

      const htmlContent = template(context);

      // B4: Render PDF
      await this.logStep(userId, actionTag, 'Đang tạo PDF...');
      const pdfBuffer = await this.createPdfFromHtml(htmlContent);

      await this.logStep(userId, actionTag, `Hoàn tất. Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

      // Tùy chọn: Lưu record vào DB user_cv nếu muốn (ở đây chỉ trả về buffer theo yêu cầu)

      return pdfBuffer;

    } catch (e) {
      const msg = `Lỗi tạo CV Template: ${e.message}`;
      await this.logStep(userId, 'GENERATE_TEMPLATE_ERROR', msg);
      throw new InternalServerErrorException(msg);
    }
  }

  // --- HELPER: PUPPETEER PDF ---
  private async createPdfFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // CSS Reset để in ấn đẹp
    const styledHtml = `
      <html><head><style>
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; font-family: Arial, sans-serif; } 
        @page { size: A4; margin: 0; }
      </style></head><body>${html}</body></html>
    `;

    await page.setContent(styledHtml, { waitUntil: 'networkidle0', timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  // --- 4. CÁC HÀM QUẢN LÝ KHÁC (GIỮ NGUYÊN) ---
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