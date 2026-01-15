// // src/dto/create-cv.dto.ts
// import { ApiProperty } from '@nestjs/swagger';
// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsEmail,
//   IsNotEmpty,
//   IsString,
//   ValidateNested,
//   IsOptional,
// } from 'class-validator';
//
// export class ExperienceDto {
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Chức danh không được để trống' })
//   @IsString()
//   jobTitle: string;
//
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Tên công ty không được để trống' })
//   @IsString()
//   company: string;
//
//   @ApiProperty()
//   @IsString()
//   duration: string;
//
//   @ApiProperty()
//   @IsOptional()
//   @IsString()
//   description: string;
// }
//
// export class EducationDto {
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Tên trường không được để trống' })
//   @IsString()
//   school: string;
//
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Bằng cấp không được để trống' })
//   @IsString()
//   degree: string;
//
//   @ApiProperty()
//   @IsString()
//   duration: string;
// }
//
// export class SkillDto {
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Kỹ năng không được để trống' })
//   @IsString()
//   name: string;
// }
//
// export class CreateCvDto {
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Họ tên không được để trống' })
//   @IsString()
//   fullName: string;
//
//   // [MỚI] Trường URL ảnh đại diện tùy chỉnh
//   @ApiProperty({ required: false })
//   @IsOptional()
//   @IsString()
//   avatarUrl?: string;
//
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Vị trí công việc không được để trống' })
//   @IsString()
//   jobTitle: string;
//
//   @ApiProperty()
//   @IsEmail({}, { message: 'Email không đúng định dạng' })
//   email: string;
//
//   @ApiProperty()
//   @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
//   @IsString()
//   phone: string;
//
//   @ApiProperty()
//   @IsString()
//   address: string;
//
//   @ApiProperty()
//   @IsOptional()
//   @IsString()
//   summary: string;
//
//   @ApiProperty({ type: [ExperienceDto] })
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => ExperienceDto)
//   experiences: ExperienceDto[];
//
//   @ApiProperty({ type: [EducationDto] })
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => EducationDto)
//   educations: EducationDto[];
//
//   @ApiProperty({ type: [SkillDto] })
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => SkillDto)
//   skills: SkillDto[];
// }