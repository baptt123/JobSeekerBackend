import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import * as base64 from 'base-64';

@Injectable()
export class ZoomService {
  private readonly zoomAccountId = process.env.ZOOM_ACCOUNT_ID;
  private readonly zoomClientId = process.env.ZOOM_CLIENT_ID;
  private readonly zoomClientSecret = process.env.ZOOM_CLIENT_SECRET;

  constructor(private readonly http: HttpService) {}

  // 🔑 Lấy access token từ Zoom
  async generateZoomAccessToken(): Promise<string> {
    try {
      const url = `https://api.zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.zoomAccountId}`;
      const authHeader = base64.encode(
        `${this.zoomClientId}:${this.zoomClientSecret}`,
      );

      const response = await firstValueFrom(
        this.http.post(
          url,
          '', // ⚠️ Body phải là chuỗi rỗng
          {
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
      return response.data.access_token;
    } catch (error) {
      console.log({
        id: this.zoomClientId,
        secret: this.zoomClientSecret,
        account: this.zoomAccountId,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error('Zoom token error:', error.response?.data || error.message);
      throw new HttpException(
        'Không thể lấy access token từ Zoom',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 🎥 Tạo cuộc họp Zoom
  async createMeeting(topic: string) {
    const accessToken = await this.generateZoomAccessToken();

    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://api.zoom.us/v2/users/me/meetings',
          {
            topic: topic || 'Cuộc họp Zoom API',
            type: 2, // Scheduled meeting
            agenda: 'Tạo Zoom meeting qua API',
            duration: 30,
            start_time: new Date().toISOString(),
            timezone: 'Asia/Ho_Chi_Minh',
            settings: {
              host_video: true,
              participant_video: true,
              join_before_host: true,
              mute_upon_entry: true,
              waiting_room: false,
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return response.data;
    } catch (error) {
      console.error(
        'Zoom createMeeting error:',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Không thể tạo meeting trên Zoom',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
