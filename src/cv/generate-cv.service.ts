import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { SkillEntity } from '../entity/skill.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';

// SDK Gemini Mới
const { GoogleGenAI } = require('@google/genai');

@Injectable()
export class GenerateCvService {
  private aiClient: any;

  constructor(
    @InjectRepository(UserCVEntity)
    private userCvRepo: Repository<UserCVEntity>,
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
    this.aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // --- HELPER LOG ---
  private async logStep(userId: number, action: string, message: string) {
    console.log(`[GEMINI-PROCESS] User:${userId} | ${action}: ${message}`);
  }

  // --- [FIXED] CLEANUP: Xóa đích danh File (nếu có) -> Xóa Store ---
  private async safeCleanupStore(storeName: string, fileResourceName: string | null, userId: number) {
    if (!storeName) return;
    try {
      await this.logStep(userId, 'CLEANUP', `Đang dọn dẹp...`);

      // 1. Nếu đã upload file thành công (có fileResourceName), xóa file đó trước
      if (fileResourceName) {
        try {
          await this.aiClient.files.delete({ name: fileResourceName });
          // console.log(`Deleted file: ${fileResourceName}`);
        } catch (e) {
          console.warn(`Không thể xóa file ${fileResourceName} (có thể đã xóa hoặc lỗi): ${e.message}`);
        }
      }

      // 2. Sau khi đảm bảo file đã bị xóa, tiến hành xóa Store
      await this.aiClient.fileSearchStores.delete({ name: storeName });
      await this.logStep(userId, 'CLEANUP_SUCCESS', `Đã xóa Store thành công.`);

    } catch (e) {
      console.error(`Lỗi cleanup store: ${JSON.stringify(e)}`);
    }
  }

  // ========================================================================
  // === UPLOAD VÀ XỬ lý CV VỚI GEMINI ===
  // ========================================================================
  async processCvWithGemini(file: Express.Multer.File, userId: number) {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Vui lòng upload file đúng định dạng PDF.');
    }

    const tempFilePath = path.join(__dirname, `temp_${userId}_${Date.now()}.pdf`);

    // Biến để theo dõi tài nguyên cần dọn dẹp
    let fileSearchStoreName = '';
    let uploadedFileResourceName = '';

    try {
      await fs.promises.writeFile(tempFilePath, file.buffer);
      await this.logStep(userId, 'START_PROCESS', `Bắt đầu xử lý file: ${file.originalname}`);

      // 1. Tạo Store
      const fileSearchStore = await this.aiClient.fileSearchStores.create({
        config: { displayName: `cv_store_${userId}_${Date.now()}` }
      });
      fileSearchStoreName = fileSearchStore.name; // Lưu tên Store

      await this.logStep(userId, 'GEMINI_UPLOAD', 'Đang upload file lên Gemini Store...');

      // 2. Upload File vào Store [ĐÃ SỬA: BỎ VÒNG LẶP WHILE]
      // Hàm này trong SDK mới thường trả về kết quả ngay sau khi upload xong
      const uploadResult = await this.aiClient.fileSearchStores.uploadToFileSearchStore({
        file: tempFilePath,
        fileSearchStoreName: fileSearchStore.name,
        config: { displayName: file.originalname }
      });

      // Lưu "name" của file (dạng 'files/xxxxx') để xóa sau này
      // uploadResult có thể là { file: { name: '...' } } hoặc trả về trực tiếp đối tượng file tùy version SDK
      if (uploadResult && uploadResult.file && uploadResult.file.name) {
        uploadedFileResourceName = uploadResult.file.name;
      } else if (uploadResult && uploadResult.name) {
        uploadedFileResourceName = uploadResult.name;
      }

      await this.logStep(userId, 'CHECK_CV_VALIDITY', 'Đang kiểm tra nội dung file...');

      // 3. Kiểm tra xem có phải CV không
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
        // Cleanup ngay
        await this.safeCleanupStore(fileSearchStoreName, uploadedFileResourceName, userId);
        throw new BadRequestException('Nội dung file tải lên không phải là một bản CV hợp lệ.');
      }

      await this.logStep(userId, 'EXTRACT_DATA', 'CV hợp lệ. Đang trích xuất kỹ năng và từ khóa...');

      // 4. Trích xuất dữ liệu
      const extractResponse = await this.aiClient.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: "Hãy trích xuất danh sách các 'technical_skills' (kỹ năng cứng/công nghệ) và 'keywords' (từ khóa quan trọng mô tả năng lực, vai trò) từ CV này.\n" +
          "Quy tắc phản hồi:\n" +
          "1. Nếu tìm thấy dữ liệu phù hợp: Trả về kết quả là một chuỗi JSON hợp lệ với định dạng: { \"skills\": [\"string\"], \"keywords\": [\"string\"] }.\n" +
          "2. Nếu KHÔNG tìm thấy bất kỳ kỹ năng hay từ khóa nào phù hợp: Hãy trả về DUY NHẤT chuỗi văn bản: \"chưa xác định\" (viết thường, không ngoặc kép, không markdown).\n" +
          "Lưu ý quan trọng: Không sử dụng markdown block code (```json) trong câu trả lời.",
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [fileSearchStore.name] } }]
        }
      });

      let extractedData = { skills: [], keywords: [] };
      let contentForDb = "chưa xác định";
      const rawText = extractResponse.text?.trim() || "";

      if (rawText.toLowerCase().includes("chưa xác định")) {
        contentForDb = "chưa xác định";
        await this.logStep(userId, 'EXTRACT_EMPTY', 'AI không tìm thấy từ khóa nào. Set content="chưa xác định".');
      } else {
        try {
          let jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          extractedData = JSON.parse(jsonStr);
          contentForDb = JSON.stringify(extractedData);
        } catch (e) {
          await this.logStep(userId, 'PARSE_ERROR', 'Lỗi parse JSON từ AI, fallback về "chưa xác định".');
          contentForDb = "chưa xác định";
        }
      }

      await this.logStep(userId, 'CLOUDINARY_UPLOAD', 'Đang upload file PDF gốc lên Cloudinary...');
      const uploadRes = await this.cloudinaryService.uploadFile(file);

      // Lưu vào DB
      const newUserCv = this.userCvRepo.create({
        user_id: userId,
        file_url: uploadRes.url,
        title: file.originalname,
        content: contentForDb,
        is_default: false,
        is_deleted: false
      });

      const savedCv = await this.userCvRepo.save(newUserCv);

      // Lưu Skills
      if (contentForDb !== "chưa xác định" && extractedData.skills && Array.isArray(extractedData.skills)) {
        for (const skillName of extractedData.skills) {
          // @ts-ignore
          const formattedName = skillName.trim();
          if (!formattedName) continue;
          let skill = await this.skillRepo.findOne({ where: { skill_name: formattedName } });
          if (!skill) {
            skill = this.skillRepo.create({ skill_name: formattedName });
            try { skill = await this.skillRepo.save(skill); } catch(e) {}
          }
          await this.saveKeywordForCv(savedCv, formattedName);
        }
      }

      // Lưu Keywords
      if (contentForDb !== "chưa xác định" && extractedData.keywords && Array.isArray(extractedData.keywords)) {
        for (const keyName of extractedData.keywords) {
          // @ts-ignore
          const formattedKey = keyName.trim();
          if (formattedKey) await this.saveKeywordForCv(savedCv, formattedKey);
        }
      }

      await this.logStep(userId, 'COMPLETE', `Hoàn tất xử lý CV. Content status: ${contentForDb === "chưa xác định" ? "NO_DATA" : "HAS_DATA"}`);

      // Cleanup thành công: Truyền cả tên Store và tên File để xóa
      await this.safeCleanupStore(fileSearchStoreName, uploadedFileResourceName, userId);

      return {
        message: 'Upload và phân tích CV thành công.',
        cv: savedCv,
        extracted_data: contentForDb === "chưa xác định" ? null : extractedData
      };

    } catch (error) {
      await this.logStep(userId, 'ERROR_PROCESS', `Lỗi xử lý: ${error.message}`);

      // Cleanup khi lỗi: Truyền cả tên Store và tên File (nếu đã kịp có)
      if (fileSearchStoreName) {
        await this.safeCleanupStore(fileSearchStoreName, uploadedFileResourceName, userId);
      }

      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(error.message);
    } finally {
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }
  }

  private async saveKeywordForCv(cv: UserCVEntity, keywordText: string) {
    if (!keywordText) return;
    let keyword = await this.keywordRepo.findOne({ where: { keyword_name: keywordText } });
    if (!keyword) {
      keyword = this.keywordRepo.create({ keyword_name: keywordText });
      try { keyword = await this.keywordRepo.save(keyword); } catch (e) {
        keyword = await this.keywordRepo.findOne({ where: { keyword_name: keywordText } });
      }
    }
    if (keyword) {
      const exists = await this.cvKeywordRepo.findOne({
        where: { cv: { cv_id: cv.cv_id }, keyword: { keyword_id: keyword.keyword_id } }
      });
      if (!exists) {
        const cvKeyword = this.cvKeywordRepo.create({ cv: cv, keyword: keyword });
        await this.cvKeywordRepo.save(cvKeyword);
      }
    }
  }

  // ========================================================================
  // === CÁC HÀM CŨ (GENERATE AI, ETC...) GIỮ NGUYÊN ===
  // ========================================================================
  async generateCvByAi(promptUser: string, userId: number) {
    const actionTag = 'GENERATE_CV_AI';
    if (!promptUser) throw new BadRequestException('Vui lòng nhập nội dung mô tả cho CV.');

    await this.logStep(userId, actionTag, `Bắt đầu tạo CV AI. Prompt: ${promptUser.substring(0, 50)}...`);

    const systemPrompt = `
      Bạn là chuyên gia thiết kế CV và UI/UX hàng đầu.
      Nhiệm vụ: Dựa trên mô tả "${promptUser}", hãy viết mã HTML5 và CSS (inline-css) đầy đủ để tạo ra một bản CV chuyên nghiệp.
      
      YÊU CẦU QUAN TRỌNG VỀ GIAO DIỆN (CHỦ ĐẠO TÍM):
      1. [MÀU SẮC]: Sử dụng tông màu Tím (Primary/Indigo - #4338CA) làm màu nhấn chủ đạo (tiêu đề, thanh bên, icon).
      2. Nền: Màu trắng (#FFFFFF) hoặc tím rất nhạt (#EEF2FF) cho các vùng phụ.
      3. Bố cục: Hiện đại, sạch sẽ, chuyên nghiệp, Responsive khi in A4.
      4. OUTPUT chỉ trả về mã HTML thuần túy bắt đầu bằng <html>. KHÔNG dùng markdown code block.
    `;

    try {
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
      await this.logStep(userId, 'UPLOAD_CV', `Người dùng ${userId} đã tải lên CV ${savedCV.cv_id}.`);
      return { message: "Tải lên thành công", cv: savedCV, keywords: extractedKeywords };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khi lưu CV vào DB: ' + e.message);
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
    await this.logStep(userId, 'DELETE_CV', `Đã xóa CV ${cvId}`);
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
      await this.logStep(userId, 'SET_DEFAULT_CV', `Set CV ${cvId} làm mặc định`);
      return { message: 'Đã đặt làm CV mặc định.' };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Lỗi giao dịch: ' + e.message);
    } finally {
      await queryRunner.release();
    }
  }
}