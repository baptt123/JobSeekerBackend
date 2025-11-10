//
// 📄 [SỬA ĐỔI] baptt123/jobseekerbackend/JobSeekerBackend-develop/src/dto/create-cv.dto.ts
//
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

// Các lớp DTO lồng nhau cho kinh nghiệm, học vấn, kỹ năng
export class ExperienceDto {
  @ApiProperty()
  @IsString()
  jobTitle: string;

  @ApiProperty()
  @IsString()
  company: string;

  @ApiProperty()
  @IsString()
  duration: string; // Ví dụ: "2020 - 2022"

  @ApiProperty()
  @IsString()
  description: string;
}

export class EducationDto {
  @ApiProperty()
  @IsString()
  school: string;

  @ApiProperty()
  @IsString()
  degree: string; // Ví dụ: "Kỹ sư phần mềm"

  @ApiProperty()
  @IsString()
  duration: string; // Ví dụ: "2018 - 2022"
}

export class SkillDto {
  @ApiProperty()
  @IsString()
  name: string;
}

export class CreateCvDto {
  // Thông tin cá nhân
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  jobTitle: string; // Vị trí mong muốn

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  summary: string; // Mục tiêu nghề nghiệp/Giới thiệu

  // Thông tin chi tiết
  @ApiProperty({ type: [ExperienceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences: ExperienceDto[];

  @ApiProperty({ type: [EducationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations: EducationDto[];

  @ApiProperty({ type: [SkillDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills: SkillDto[];
}
