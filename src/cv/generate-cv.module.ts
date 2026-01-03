import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from 'src/entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { JobEntity } from '../entity/job.entity';
import { GenerateCvService } from './generate-cv.service';
import { GenAIModule } from 'nestjs-genai';
import { GenerateCvController } from './generate-cv.controller';
import { CloudinaryCustomModule } from '../cloudinary-custom/cloudinary-custom.module';
import { LogEntity } from '../entity/log.entity';
import { SkillEntity } from '../entity/skill.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserCVEntity,
      UserEntity,
      KeywordEntity,
      CVKeywordEntity,
      JobEntity,
      LogEntity,
      SkillEntity, // <--- Đăng ký Repository
    ]),
    GenAIModule.forRoot({
      apiKey: process.env.GEMINI_API_KEY, // .env
    }),
    CloudinaryCustomModule,
  ],
  controllers: [GenerateCvController],
  providers: [GenerateCvService],
  exports: [GenerateCvService],
})
export class GenerateCvModule {}
