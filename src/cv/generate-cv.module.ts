import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from 'src/entity/user.entity';
import { KeywordEntity } from '../entity/keyword.entity';
import { CVKeywordEntity } from '../entity/cv-keyword.entity';
import { JobEntity } from '../entity/job.entity';
import { GenerateCvService } from './generate-cv.service';
import { GeminiModule } from '../gemini-generating-cv/gemini.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserCVEntity,
      UserEntity,
      KeywordEntity,
      CVKeywordEntity,
      JobEntity,
    ]),
    GeminiModule,
  ],
  providers: [GenerateCvService],
  exports: [GenerateCvService],
})
export class GenerateCvModule {}
