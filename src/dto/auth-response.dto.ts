import { UserPayloadDto } from './user-payload.dto';

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
