import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import * as base64 from 'base-64';
import { CreateMeetingDto } from '../dto/create-meeting.dto';

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly zoomAccountId = process.env.ZOOM_ACCOUNT_ID;
  private readonly zoomClientId = process.env.ZOOM_CLIENT_ID;
  private readonly zoomClientSecret = process.env.ZOOM_CLIENT_SECRET;

  constructor(private readonly http: HttpService) {}

  // 🔑 Lấy access token từ Zoom (Giữ nguyên logic chuẩn)
  async generateZoomAccessToken(): Promise<string> {
    try {
      const url = `https://api.zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.zoomAccountId}`;
      const authHeader = base64.encode(
        `${this.zoomClientId}:${this.zoomClientSecret}`,
      );

      const response = await firstValueFrom(
        this.http.post(url, '', {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return response.data.access_token;
    } catch (error) {
      this.logger.error('Lỗi lấy Zoom Token', error.response?.data);
      throw new HttpException(
        'Không thể kết nối tới Zoom API',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // 🎥 Tạo cuộc họp Zoom (Cập nhật logic thực tế)
  async createMeeting(dto: CreateMeetingDto) {
    const accessToken = await this.generateZoomAccessToken();
    const { topic, agenda, startTime, duration } = dto;

    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://api.zoom.us/v2/users/me/meetings',
          {
            topic: topic,
            type: 2, // 2 = Scheduled meeting (Lên lịch)
            start_time: startTime, // Thời gian bắt đầu
            duration: duration, // Thời lượng phút
            timezone: 'Asia/Ho_Chi_Minh', // Quan trọng để hiển thị đúng giờ
            agenda: agenda || 'Phỏng vấn tuyển dụng',
            settings: {
              host_video: true, // Bật cam host
              participant_video: true, // Bật cam ứng viên
              join_before_host: false, // Không cho vào trước host để bảo mật
              mute_upon_entry: true, // Tắt mic khi mới vào
              waiting_room: true, // Bật phòng chờ (Chuyên nghiệp)
              auto_recording: 'none', // Hoặc 'cloud' nếu muốn tự động ghi hình
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const data = response.data;

      // Trả về dữ liệu sạch để lưu vào DB
      return {
        meetingId: data.id,
        topic: data.topic,
        joinUrl: data.join_url, // Link cho ứng viên
        startUrl: data.start_url, // Link cho Recruiter (Host)
        password: data.password, // Mật khẩu phòng
        startTime: data.start_time,
        duration: data.duration,
      };
    } catch (error) {
      this.logger.error(
        'Zoom createMeeting error:',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Không thể tạo meeting trên Zoom. Vui lòng kiểm tra lại tài khoản.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
