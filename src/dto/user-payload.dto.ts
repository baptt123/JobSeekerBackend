// src/auth/dto/auth-response.dto.ts

/**
 * Định nghĩa cấu trúc của object user sẽ trả về
 * (Khớp với { id: ..., email: ... } mà _generateSystemJwt tạo ra)
 */
export class UserPayloadDto {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  role_id: number;
}
