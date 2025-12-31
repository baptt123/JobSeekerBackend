import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { LogEntity } from '../entity/log.entity';
import { UserEntity } from '../entity/user.entity';
import { CloudinaryCustomService } from '../cloudinary-custom/cloudinary-custom.service';
import * as fs from 'fs';
import * as path from 'path';

// Import GoogleGenAI (Node.js SDK v2)
const { GoogleGenAI } = require('@google/genai');

@Injectable()
export class GenerateCvService {
  private ai: any;

  constructor(
    @InjectRepository(UserCVEntity)
    private userCvRepo: Repository<UserCVEntity>,
    @InjectRepository(LogEntity)
    private logRepo: Repository<LogEntity>,
    private cloudinaryService: CloudinaryCustomService,
  ) {
    // Khởi tạo Gemini Client
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // --- 1. Upload CV & Rút trích Keyword (Dùng Gemini File Search) ---
  async uploadAndExtractKeywords(file: Express.Multer.File, userId: number) {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Chỉ chấp nhận file PDF');
    }

    // 1. Upload Cloudinary để lưu trữ lâu dài
    const uploadRes = await this.cloudinaryService.uploadFile(file);

    // 2. Rút trích từ khóa dùng Gemini File Search API
    let extractedKeywords = "chưa xác định";
    const tempFilePath = path.join(__dirname, `../../temp-${Date.now()}.pdf`);

    try {
      // Ghi file tạm để SDK upload
      fs.writeFileSync(tempFilePath, file.buffer);

      // A. Create Store
      const fileSearchStore = await this.ai.fileSearchStores.create({
        config: { displayName: `cv_store_user_${userId}_${Date.now()}` }
      });

      // B. Upload File to Store
      let operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
        file: tempFilePath, // Đường dẫn file
        fileSearchStoreName: fileSearchStore.name,
        config: { displayName: file.originalname }
      });

      // C. Polling Check Status
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Đợi 2s
        operation = await this.ai.operations.get({ operation });
      }

      // D. Generate Content with File Search Tool
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash", // Dùng 1.5 Flash hoặc 2.5 tuỳ key của bạn
        contents: "Hãy liệt kê các kỹ năng chuyên môn (technical skills) có trong file CV này. Chỉ trả về danh sách các từ khoá cách nhau bởi dấu phẩy.",
        config: {
          tools: [{
            fileSearch: {
              fileSearchStoreNames: [fileSearchStore.name]
            }
          }]
        }
      });

      if (response.text) {
        extractedKeywords = response.text;
      }

    } catch (error) {
      console.error("Gemini Error:", error);
      // Không throw lỗi chết app, chỉ log lại, keywords vẫn là "chưa xác định"
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    // 3. Lưu xuống DB
    const newCV = this.userCvRepo.create({
      user_id: userId,
      file_url: uploadRes.url,
      title: file.originalname,
      is_default: false,
      is_deleted: false
    });
    const savedCV = await this.userCvRepo.save(newCV);

    // 4. Ghi Log
    await this.logRepo.save({
      action: 'UPLOAD_CV',
      details: `User ${userId} uploaded CV. Extracted: ${extractedKeywords}`,
      user: { id: userId } as unknown as UserEntity,
    });

    return { cv: savedCV, keywords: extractedKeywords };
  }

  // --- 2. Tạo CV thông qua Gemini API (Trả về PDF) ---
  async generateCvByAi(promptUser: string, userId: number) {
    try {
      // Prompt ép kiểu HTML/CSS và ảnh
      const systemPrompt = `Bạn là chuyên gia tạo CV. Dựa trên thông tin: "${promptUser}".
      Hãy tạo một bản CV HTML/CSS hoàn chỉnh.
      Yêu cầu:
      1. Có ảnh đại diện (dùng link placeholder: https://via.placeholder.com/150).
      2. Bố cục chuyên nghiệp.
      3. Chỉ trả về mã HTML.
      4.Nếu không tin không đủ thì hãy tự tạo thêm thông tin để bỏ vào CV.
      5.Bố cục CV phải đẹp,rõ ràng,đẹp mắt phù hợp với ngành nghề,thiết kế đẹp.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt
      });

      const htmlContent = response.text;
      if (!htmlContent) throw new Error('AI không phản hồi nội dung');

      // Giả lập convert HTML -> PDF (Cần thư viện như puppeteer trong thực tế)
      // Ở đây ta trả về Buffer từ HTML để Frontend nhận như một file PDF
      const pdfBuffer = Buffer.from(htmlContent); // Thực tế: await htmlToPdf(htmlContent)

      // Ghi log
      await this.logRepo.save({
        action: 'GENERATE_CV_AI',
        details: `User ${userId} generated CV via AI`,
        user: { id: userId } as unknown as UserEntity,
      });

      return pdfBuffer;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi tạo CV AI: ' + error.message);
    }
  }

  // --- 3. Tạo CV từ Template ---
  async generateCvFromTemplate(templateId: number, data: any, userId: number) {
    // Validation cơ bản
    if (!data.fullName || !data.email) throw new BadRequestException('Thiếu thông tin bắt buộc');

    // Lấy link ảnh từ DB user (giả định có UserEntity)
    // const user = await this.userRepo.findOne(userId);
    const avatarUrl = data.avatarUrl || "https://example.com/default-avatar.png";

    // Logic điền template (HBS logic cũ của bạn)
    // Giả lập trả về PDF Buffer
    const pdfBuffer = Buffer.from(`PDF Content based on Template ${templateId} for ${data.fullName} with avatar ${avatarUrl}`);

    await this.logRepo.save({
      action: 'GENERATE_CV_TEMPLATE',
      details: `User ${userId} used Template ${templateId}`,
      user: { id: userId } as unknown as UserEntity,
    });

    return pdfBuffer;
  }

  // --- 4. Quản lý CV (List, Soft Delete, Set Default) ---
  async getMyCvs(userId: number) {
    return this.userCvRepo.find({
      where: { user_id: userId, is_deleted: false },
      order: { created_at: 'DESC' }
    });
  }

  async softDeleteCv(cvId: number, userId: number) {
    await this.userCvRepo.update(
      { cv_id: cvId, user_id: userId },
      { is_deleted: true, deleted_at: new Date() }
    );
    await this.logRepo.save({
      action: 'DELETE_CV',
      details: `User ${userId} soft deleted CV ${cvId}`,
      user: { id: userId } as unknown as UserEntity,
    });
    return { message: 'Đã xóa CV' };
  }

  async setDefaultCv(cvId: number, userId: number) {
    // Reset toàn bộ về false
    await this.userCvRepo.update({ user_id: userId }, { is_default: false });
    // Set CV chọn thành true
    await this.userCvRepo.update(
      { cv_id: cvId, user_id: userId },
      { is_default: true },
    );

    await this.logRepo.save({
      action: 'SET_DEFAULT_CV',
      details: `User ${userId} set CV ${cvId} as default`,
      user: { id: userId } as unknown as UserEntity
    });
    return { message: 'Đã đặt làm mặc định' };
  }
}