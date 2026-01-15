// import { IsNotEmpty, IsNumber, ValidateNested, IsObject } from 'class-validator';
// import { Type } from 'class-transformer';
// import { CreateCvDto } from './create-cv.dto';
//
// export class GenerateTemplateDto {
//   @IsNotEmpty({ message: 'Vui lòng chọn mẫu CV (templateId).' })
//   @IsNumber()
//   templateId: number;
//
//   @IsNotEmpty({ message: 'Dữ liệu CV không được để trống.' })
//   @IsObject()
//   @ValidateNested()
//   @Type(() => CreateCvDto)
//   data: CreateCvDto;
// }