import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { LogEntity } from '../entity/log.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity'; // Import thêm
import { CVKeywordEntity } from '../entity/cv-keyword.entity'; // Import thêm
import { SkillEntity } from '../entity/skill.entity'; // Import thêm
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import { CreateCvDto } from '../dto/create-cv.dto';

// SDK Gemini Mới
const { GoogleGenAI } = require('@google/genai');

@Injectable()
export class GenerateCvService {
  private aiClient: any; // Client riêng cho SDK @google/genai

  constructor(
    @InjectRepository(UserCVEntity)
    private userCvRepo: Repository<UserCVEntity>,
    @InjectRepository(LogEntity)
    private logRepo: Repository<LogEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(KeywordEntity)
    private keywordRepo: Repository<KeywordEntity>,
    @InjectRepository(CVKeywordEntity)
    private cvKeywordRepo: Repository<CVKeywordEntity>,
    @InjectRepository(SkillEntity)
    private skillRepo: Repository<SkillEntity>,
    private cloudinaryService: CloudinaryCustomService,
    private dataSource: DataSource,
  ) {
    // Khởi tạo SDK @google/genai
    this.aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // --- HELPER LOG ---
  private async logStep(userId: number, action: string, message: string) {
    console.log(`[GEMINI-PROCESS] User:${userId} | ${action}: ${message}`);
    try {
      await this.logRepo.save({
        action: action,
        details: message,
        user: { user_id: userId } as UserEntity,
      });
    } catch (err) { console.error('Log Error:', err); }
  }


  // ========================================================================
  // === LOGIC MỚI: UPLOAD VÀ XỬ LÝ CV VỚI GEMINI 2 GIAI ĐOẠN ===
  // ========================================================================
  async processCvWithGemini(file: Express.Multer.File, userId: number) {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Vui lòng upload file đúng định dạng PDF.');
    }

    const tempFilePath = path.join(__dirname, `temp_${userId}_${Date.now()}.pdf`);

    try {
      // 0. Lưu file tạm thời để SDK đọc
      await fs.promises.writeFile(tempFilePath, file.buffer);
      await this.logStep(userId, 'START_PROCESS', `Bắt đầu xử lý file: ${file.originalname}`);

      // 1. Upload lên Gemini FileSearchStore
      const fileSearchStore = await this.aiClient.fileSearchStores.create({
        config: { displayName: `cv_store_${userId}_${Date.now()}` }
      });

      await this.logStep(userId, 'GEMINI_UPLOAD', 'Đang upload file lên Gemini Store...');

      let operation = await this.aiClient.fileSearchStores.uploadToFileSearchStore({
        file: tempFilePath,
        fileSearchStoreName: fileSearchStore.name,
        config: { displayName: file.originalname }
      });

      // Polling chờ xử lý (đợi file được embed xong)
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        operation = await this.aiClient.operations.get({ operation });
      }

      // --- GIAI ĐOẠN 1: KIỂM TRA TÍNH HỢP LỆ (IS CV?) ---
      await this.logStep(userId, 'CHECK_CV_VALIDITY', 'Đang kiểm tra nội dung file...');

      const checkResponse = await this.aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Bạn là chuyên gia nhân sự. Hãy phân tích file đính kèm. Trả lời chính xác 'YES' nếu nội dung file là một bản CV (Sơ yếu lý lịch/Resume) hợp lệ. Trả lời 'NO' nếu không phải. Không giải thích gì thêm.",
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [fileSearchStore.name] } }]
        }
      });

      const isCv = checkResponse.text?.trim().toUpperCase().includes('YES');

      if (!isCv) {
        await this.logStep(userId, 'CHECK_FAIL', 'File không phải là CV hợp lệ.');
        // Cleanup Store ngay nếu không phải CV
        await this.aiClient.fileSearchStores.delete({ name: fileSearchStore.name });
        throw new BadRequestException('Nội dung file tải lên không phải là một bản CV hợp lệ.');
      }

      // --- GIAI ĐOẠN 2: TRÍCH XUẤT KEYWORDS & SKILLS ---
      await this.logStep(userId, 'EXTRACT_DATA', 'CV hợp lệ. Đang trích xuất kỹ năng và từ khóa...');

      // [UPDATE] Prompt yêu cầu trả về "chưa xác định" nếu rỗng
      const extractResponse = await this.aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hãy trích xuất danh sách các 'technical_skills' (kỹ năng cứng/công nghệ) và 'keywords' (từ khóa quan trọng mô tả năng lực, vai trò) từ CV này.\n" +
          "Quy tắc phản hồi:\n" +
          "1. Nếu tìm thấy dữ liệu phù hợp: Trả về kết quả là một chuỗi JSON hợp lệ với định dạng: { \"skills\": [\"string\"], \"keywords\": [\"string\"] }.\n" +
          "2. Nếu KHÔNG tìm thấy bất kỳ kỹ năng hay từ khóa nào phù hợp: Hãy trả về DUY NHẤT chuỗi văn bản: \"chưa xác định\" (viết thường, không ngoặc kép, không markdown).\n" +
          "Lưu ý quan trọng: Không sử dụng markdown block code (```json) trong câu trả lời.",
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [fileSearchStore.name] } }]
        }
      });

      // Biến chứa dữ liệu đã parse (để lưu vào bảng quan hệ)
      let extractedData = { skills: [], keywords: [] };
      // Biến chứa chuỗi sẽ lưu vào cột 'content' của UserCv (JSON string hoặc "chưa xác định")
      let contentForDb = "chưa xác định";

      const rawText = extractResponse.text?.trim() || "";

      // Kiểm tra xem AI có trả về "chưa xác định" hay không
      if (rawText.toLowerCase().includes("chưa xác định")) {
        contentForDb = "chưa xác định";
        await this.logStep(userId, 'EXTRACT_EMPTY', 'AI không tìm thấy từ khóa nào. Set content="chưa xác định".');
      } else {
        // Cố gắng parse JSON
        try {
          let jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          extractedData = JSON.parse(jsonStr);
          // Nếu parse thành công, lưu chuỗi JSON vào DB
          contentForDb = JSON.stringify(extractedData);
        } catch (e) {
          await this.logStep(userId, 'PARSE_ERROR', 'Lỗi parse JSON từ AI, fallback về "chưa xác định".');
          contentForDb = "chưa xác định";
        }
      }

      // 3. Upload File lên Cloudinary
      await this.logStep(userId, 'CLOUDINARY_UPLOAD', 'Đang upload file PDF gốc lên Cloudinary...');
      const uploadRes = await this.cloudinaryService.uploadFile(file);

      // 4. Lưu vào Database

      // A. Lưu UserCV
      const newUserCv = this.userCvRepo.create({
        user_id: userId,
        file_url: uploadRes.url,
        title: file.originalname,
        content: contentForDb, // [QUAN TRỌNG] Lưu JSON string hoặc "chưa xác định"
        is_default: false,
        is_deleted: false
      });

      const savedCv = await this.userCvRepo.save(newUserCv);

      // B. Xử lý Skills (Chỉ thực hiện nếu có dữ liệu extractedData hợp lệ)
      if (contentForDb !== "chưa xác định" && extractedData.skills && Array.isArray(extractedData.skills)) {
        for (const skillName of extractedData.skills) {
          // @ts-ignore
          const formattedName = skillName.trim();
          if (!formattedName) continue;

          let skill = await this.skillRepo.findOne({ where: { skill_name: formattedName } });
          if (!skill) {
            skill = this.skillRepo.create({ skill_name: formattedName });
            try { skill = await this.skillRepo.save(skill); } catch(e) {} // Bỏ qua lỗi duplicate race condition
          }
          await this.saveKeywordForCv(savedCv, formattedName);
        }
      }

      // C. Xử lý Keywords
      if (contentForDb !== "chưa xác định" && extractedData.keywords && Array.isArray(extractedData.keywords)) {
        for (const keyName of extractedData.keywords) {
          // @ts-ignore
          const formattedKey = keyName.trim();
          if (formattedKey) await this.saveKeywordForCv(savedCv, formattedKey);
        }
      }

      await this.logStep(userId, 'COMPLETE', `Hoàn tất xử lý CV. Content status: ${contentForDb === "chưa xác định" ? "NO_DATA" : "HAS_DATA"}`);

      // Cleanup Gemini Store để tiết kiệm tài nguyên
      try { await this.aiClient.fileSearchStores.delete({ name: fileSearchStore.name }); } catch (e) {}

      return {
        message: 'Upload và phân tích CV thành công.',
        cv: savedCv,
        extracted_data: contentForDb === "chưa xác định" ? null : extractedData
      };

    } catch (error) {
      await this.logStep(userId, 'ERROR_PROCESS', `Lỗi xử lý: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(error.message);
    } finally {
      // Luôn xóa file tạm
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }
  }

  // Helper lưu Keyword cho CV
  private async saveKeywordForCv(cv: UserCVEntity, keywordText: string) {
    if (!keywordText) return;

    // 1. Tìm hoặc tạo Keyword
    let keyword = await this.keywordRepo.findOne({ where: { keyword_name: keywordText } });
    if (!keyword) {
      keyword = this.keywordRepo.create({ keyword_name: keywordText });
      try { keyword = await this.keywordRepo.save(keyword); } catch (e) {
        keyword = await this.keywordRepo.findOne({ where: { keyword_name: keywordText } });
      }
    }

    if (keyword) {
      // 2. Tạo liên kết CV - Keyword
      const exists = await this.cvKeywordRepo.findOne({
        where: { cv: { cv_id: cv.cv_id }, keyword: { keyword_id: keyword.keyword_id } }
      });
      if (!exists) {
        const cvKeyword = this.cvKeywordRepo.create({
          cv: cv,
          keyword: keyword
        });
        await this.cvKeywordRepo.save(cvKeyword);
      }
    }
  }

  // ========================================================================
  // === CÁC HÀM CŨ (GIỮ NGUYÊN LOGIC) ===
  // ========================================================================

  async uploadAndExtractKeywords(file: Express.Multer.File, userId: number) {
    // ... Logic cũ của bạn ...
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
      await this.logStep(userId, 'UPLOAD_CV', `Người dùng ${userId} đã tải lên CV ${savedCV.cv_id}.`);
      return { message: "Tải lên thành công", cv: savedCV, keywords: extractedKeywords };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khi lưu CV vào DB: ' + e.message);
    }
  }

  async generateCvByAi(promptUser: string, userId: number) {
    // ... Logic cũ giữ nguyên ...
    const actionTag = 'GENERATE_CV_AI';
    if (!promptUser) throw new BadRequestException('Vui lòng nhập nội dung mô tả cho CV.');
    await this.logStep(userId, actionTag, `Bắt đầu quy trình tạo CV. Prompt: ${promptUser.substring(0, 50)}...`);

    const systemPrompt = `
      Đóng vai chuyên gia thiết kế CV chuyên nghiệp.
      Nhiệm vụ: Dựa trên mô tả "${promptUser}", hãy viết mã HTML5 và CSS (inline-css) đầy đủ để tạo ra một bản CV đẹp mắt.
      YÊU CẦU KỸ THUẬT: OUTPUT chỉ trả về mã HTML thuần túy. KHÔNG markdown.
    `;

    try {
      // Lưu ý: Hàm này dùng this.ai (Gemini cũ/hoặc khác config) nếu bạn muốn giữ logic cũ
      // Ở đây tôi giả định logic cũ bạn muốn giữ nguyên
      const response = await this.aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt
      });
      let htmlContent = response.text || "";
      htmlContent = htmlContent.replace(/```html/g, '').replace(/```/g, '').trim();

      if (!htmlContent.startsWith('<') || htmlContent.length < 50) throw new Error("AI data invalid");

      const pdfBuffer = await this.createPdfFromHtml(htmlContent);
      await this.logStep(userId, actionTag, `Thành công. Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB.`);
      return pdfBuffer;
    } catch (e) {
      await this.logStep(userId, 'GENERATE_CV_ERROR', e.message);
      throw new InternalServerErrorException('Lỗi tạo CV AI.');
    }
  }

  async generateCvFromTemplate(templateId: number, data: CreateCvDto, userId: number) {
    // ... Logic cũ giữ nguyên ...
    const actionTag = 'GENERATE_CV_TEMPLATE';
    try {
      const user = await this.userRepo.findOne({ where: { user_id: userId } });
      if (!user) throw new NotFoundException('User not found');
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=random&size=200`;
      const userAvatar = (user.avatar_url && user.avatar_url.trim() !== '') ? user.avatar_url : defaultAvatar;

      const templateFileName = templateId === 2 ? 'cv_template_2.hbs' : 'cv_template_1.hbs';
      const templatePath = path.join(process.cwd(), 'views', templateFileName);

      if (!fs.existsSync(templatePath)) throw new NotFoundException(`Template not found: ${templateFileName}`);
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      const htmlContent = template({ cv: { ...data, avatar: userAvatar } });

      return await this.createPdfFromHtml(htmlContent);
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  private async createPdfFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const styledHtml = `<html><head><style>body { font-family: Arial; }</style></head><body>${html}</body></html>`;
    await page.setContent(styledHtml, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdfBuffer);
  }

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