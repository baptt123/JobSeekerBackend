import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { Repository } from 'typeorm';
import { JobEntity } from '../entity/job.entity';
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
  async getCvHtml(userPrompt: string): Promise<string> {
    // 1. Xây dựng prompt cuối cùng
    const finalPrompt = `
## MỤC TIÊU CUỐI CÙNG ##
Tạo một tài liệu HTML CV chuyên nghiệp, đầy đủ nội dung.

## BƯỚC 1: PHÂN TÍCH YÊU CẦU NGƯỜI DÙNG ##
Đây là những gì người dùng muốn. Hãy đọc kỹ để lấy thông tin:
"${userPrompt}"

## BƯỚC 2: HƯỚNG DẪN TẠO CV ##
1.  Dựa vào thông tin ở BƯỚC 1, hãy rút trích các kỹ năng, kinh nghiệm, học vấn.
2.  **QUAN TRỌNG NHẤT (FALLBACK):** Nếu thông tin người dùng cung cấp quá ít, không đủ, hoặc không liên quan (ví dụ: họ chỉ nói "làm cv cho tôi"), BẠN PHẢI TỰ ĐỘNG CHỌN MỘT VAI TRÒ MẶC ĐỊNH (ví dụ: "Lập trình viên Backend Node.js 2 năm kinh nghiệm") và TỰ BỊA RA toàn bộ nội dung (kỹ năng, kinh nghiệm, học vấn) để tạo ra một CV mẫu hoàn chỉnh.
3.  Mục tiêu là **LUÔN LUÔN** trả về một CV HTML có nội dung, không bao giờ được báo lỗi là "thiếu thông tin".
4.  Font chữ: Hãy sử dụng các font phổ biến, an toàn cho web (web-safe fonts) như Arial, Helvetica, sans-serif trong CSS.

## BƯỚC 3: YÊU CẦU ĐỊNH DẠNG ĐẦU RA (NGHIÊM NGẶT) ##
1.  **CHỈ HTML:** Chỉ trả về mã HTML thô (raw HTML).
2.  **KHÔNG GIẢI THÍCH:** Tuyệt đối không viết bất kỳ văn bản nào trước \`<!DOCTYPE html>\` hoặc sau \`</html>\`.
3.  **KHÔNG MARKDOWN:** Tuyệt đối không sử dụng các dấu \`\`\` hoặc \`\`\`html.
4.  **CSS NỘI BỘ (Internal CSS):** Tất cả CSS phải được nhúng bên trong một thẻ \`<style>\` duy nhất đặt trong phần \`<head>\`.
5.  **HOÀN CHỈNH:** Phải là một tài liệu HTML đầy đủ.
  `;

    // Thêm console.log để xem prompt GỬI ĐI
    console.log('[AI_DEBUG] Prompt cuối cùng gửi đi:', finalPrompt);

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash', // (Lưu ý: Bạn dùng 1.5-flash trong code, không phải 2.5)
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }], // Gửi theo cấu trúc chuẩn
      // config: { thinkingConfig: { thinkingBudget: 0 } }, // Cờ này có thể không cần thiết
    });

    // --- PHẦN DEBUG ---
    console.log(
      '[AI_DEBUG] Response thô từ Google:',
      JSON.stringify(response, null, 2),
    );

    const html = response.text?.trim();
    console.log(
      '[AI_DEBUG] Text đã trích xuất (đầu):',
      html?.substring(0, 200),
    );
    console.log('[AI_DEBUG] Text đã trích xuất (cuối):', html?.slice(-200));
    // --- KẾT THÚC DEBUG ---

    // Kiểm tra cả đầu và đuôi
    if (
      !html ||
      !html.toLowerCase().startsWith('<!doctype html>') || // Dùng toLowerCase cho an toàn
      !html.toLowerCase().endsWith('</html>')
    ) {
      throw new Error('AI không trả về HTML hợp lệ. Nội dung trả về: ' + html);
    }

    return html;
  }
}
