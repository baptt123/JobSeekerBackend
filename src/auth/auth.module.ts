// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config'; // ✅ Import Config
import { JwtStrategy } from '../strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { JwtRefreshTokenStrategy } from '../strategies/jwt-refresh-token-strategy';
import { AuthController } from './auth.controller';
import { FirebaseModuleModule } from '../firebase-module/firebase-module.module';
import { FirebaseAuthStrategy } from '../strategies/firebase-auth.strategy';
import { JwtWebStrategy } from '../strategies/jwt-web.strategy';
import { WebAuthController } from './web-auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';

@Module({
  imports: [
    UserModule,
    PassportModule,
    // ✅ Dùng registerAsync để đảm bảo load biến môi trường trước
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        // 🔥 SỬA: Đổi JWT_ACCESS_TOKEN_SECRET -> JWT_ACCESS_SECRET
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret',
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m',
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity]),
    FirebaseModuleModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshTokenStrategy,
    FirebaseAuthStrategy,
    JwtWebStrategy, // <--- THÊM VÀO ĐÂY
  ],
  controllers: [AuthController, WebAuthController],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
