import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { UserEntity } from './entity/user.entity';
import { RoleEntity } from './entity/role.entity';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './exception/global-exception.filter';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { JobEntity } from './entity/job.entity';
import { GenerateCvModule } from './cv/generate-cv.module';
import { CloudinaryCustomModule } from './cloudinary-custom/cloudinary-custom.module';
import { JobModule } from './job/job.module';
import * as process from 'node:process';
import { CompanyEntity } from './entity/company.entity';
import { CVKeywordEntity } from './entity/cv-keyword.entity';
import { JobApplicationEntity } from './entity/job-application.entity';
import { JobSkillEntity } from './entity/job-skill.entity';
import { KeywordEntity } from './entity/keyword.entity';
import { MessageEntity } from './entity/messages.entity';
import { NotificationEntity } from './entity/notification.entity';
import { SavedJobEntity } from './entity/save_job.entity';
import { SkillEntity } from './entity/skill.entity';
import { UserCVEntity } from './entity/user-cv.entity';
import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { GenAIModule } from 'nestjs-genai';
import { CallHistoryEntity } from './entity/call-history.entity';
import { ZoomModule } from './zoom/zoom.module';
import { MessageModule } from './message/message.module';
import { FirebaseModuleModule } from './firebase-module/firebase-module.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GenAIModule.forRoot({
      apiKey: process.env.GEMINI_API_KEY, // <-- cần key hợp lệ
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password:
        process.env.DB_PASS && process.env.DB_PASS.trim() !== ''
          ? process.env.DB_PASS
          : undefined, // 👈 nếu không có password thì để null
      database: process.env.DB_NAME || 'job_seeker',
      entities: [
        UserEntity,
        RoleEntity,
        JobEntity,
        CompanyEntity,
        CVKeywordEntity,
        JobApplicationEntity,
        JobSkillEntity,
        KeywordEntity,
        MessageEntity,
        NotificationEntity,
        SavedJobEntity,
        SkillEntity,
        UserCVEntity,
        CallHistoryEntity,
        ConfigModule,
      ],
      autoLoadEntities: true,
      synchronize: true, // chỉ bật true khi dev
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MailerOptions => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: configService.get<string>('EMAIL_ID'),
            pass: configService.get<string>('EMAIL_PASS'),
          },
        },
        defaults: {
          from: `"Backend Job Seeker App" <${configService.get<string>('EMAIL_ID')}>`,
        },
        template: {
          dir: join(__dirname, '..', 'src', 'templates'), // <-- quan trọng
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
    UserModule,
    AuthModule,
    JobModule,
    MessageModule,
    GenerateCvModule,
    CloudinaryCustomModule,
    ZoomModule,
    FirebaseModuleModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [],
})
export class AppModule {}
