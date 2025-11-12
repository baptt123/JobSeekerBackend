// src/auth/dto/auth-response.dto.ts

/**
 * Định nghĩa cấu trúc của object user sẽ trả về
 * (Khớp với { id: ..., email: ... } mà _generateSystemJwt tạo ra)
 */
class UserPayloadDto {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  role_id: number;
}

/**
 * Dữ liệu trả về cho client sau khi đăng nhập thành công
 */
export class AuthResponseDto {
  /**
   * JWT Access Token (thời gian ngắn)
   */
  accessToken: string;

  /**
   * JWT Refresh Token (thời gian dài)
   */
  refreshToken: string; // 👈 1. Thêm refreshToken

  /**
   * Thông tin user đã được map (khớp với Flutter)
   */
  user: UserPayloadDto; // 👈 2. Đổi 'userId' thành object 'user'
}