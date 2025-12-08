import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsNotEmpty()
  @IsEnum(['Screening', 'Interview', 'Offer', 'Accepted', 'Rejected'])
  status: 'Screening' | 'Interview' | 'Offer' | 'Accepted' | 'Rejected';
}
