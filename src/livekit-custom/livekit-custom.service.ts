import { Injectable } from '@nestjs/common';
// Import thêm `VideoGrant` để code tường minh và có type-safety
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

@Injectable()
export class LivekitCustomService {
  private readonly apiKey = 'devkey';
  private readonly apiSecret = 'secret';
  private readonly serverUrl =
    process.env.LIVEKIT_URL || 'http://localhost:7880';

  async createToken(roomName: string, identity: string) {
    // ✅ Tạo AccessToken (không cần truyền grant ở đây)
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      // Sử dụng chuỗi thời gian cho dễ đọc hơn, ví dụ: '1h', '1d', '5m'
      ttl: '1h',
    });

    // ✅ Định nghĩa các quyền một cách tường minh
    const videoGrant: VideoGrant = {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    };

    // ✅ Sử dụng phương thức `addGrant` theo cú pháp mới
    at.addGrant(videoGrant);

    // ✅ Sinh JWT
    const token = await at.toJwt();

    return {
      token,
      serverUrl: this.serverUrl,
      roomName,
      identity,
    };
  }
}