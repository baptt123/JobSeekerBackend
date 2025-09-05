import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { UserEntity } from './entity/user.entity';
import { RoleEntity } from './entity/role.entity';
import { MailerModule, MailerService } from '@nestjs-modules/mailer';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './filter/global-exception.filter';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { JobModule } from './job/job.module';
import { JobEntity } from './entity/job.entity';
import { MessageModule } from './message/message.module';
import { GeminiModule } from './gemini/gemini.module';
import { GenAIModule } from 'nestjs-genai';
import { ChatgptModule } from './chatgpt/chatgpt.module';
import { OpenAI } from 'openai';
import { GenerateCvModule } from './generate-cv/generate-cv.module';
import { JobApplicationModule } from './job-application/job-application.module';
import { NotificationModule } from './notification/notification.module';
import * as process from 'node:process';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [UserEntity, RoleEntity, JobEntity],
      synchronize: false, // set to true only in dev
    }),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_ID,
          pass: process.env.EMAIL_PASS,
        },
      },
      defaults: {
        from: '"Your App" <yourapp@gmail.com>',
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: { strict: true },
      },
    }),
    UserModule,
    AuthModule,
    MailerService,
    JobModule,
    MessageModule,
    GeminiModule,
    GenAIModule.forRoot({
      apiKey: process.env.GEMINI_API_KEY, // Replace with your actual API key
    }),
    ChatgptModule,
    GenerateCvModule,
    JobApplicationModule,
    NotificationModule,
  ],
  providers: [
    //GlobalExceptionFilter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: 'OPENAI_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new OpenAI({
          apiKey: configService.get<string>('OPENAI_API_KEY'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['OPENAI_CLIENT'],
})
export class AppModule {}
