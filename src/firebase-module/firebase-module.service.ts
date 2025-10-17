// src/firebase/firebase.service.ts
import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config'; // Sử dụng @nestjs/config để quản lý biến môi trường

@Injectable()
export class FirebaseModuleService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    // Kiểm tra xem biến có tồn tại không
    if (!privateKey) {
      throw new InternalServerErrorException(
        'Firebase private key không được khởi tạo thành công từ biến môi trường.',
      );
    }

    const firebaseConfig = {
      projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      privateKey: privateKey.replace(/\\n/g, '\n'), // Giờ đã an toàn để gọi .replace()
      clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
    };

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
      });
      console.log('Firebase Admin đã được khởi tạo thành công.');
    }
  }

  getAuth(): admin.auth.Auth {
    return admin.auth();
  }
}
