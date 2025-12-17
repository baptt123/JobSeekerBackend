import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsNotEmpty()
  @IsIn([
    'Applied',
    'Screening',
    'Interview',
    'Offer',
    'Accepted',
    'Rejected',
  ]) // Khớp với entity/job-application.entity.ts
  status:
    | 'Applied'
    | 'Screening'
    | 'Interview'
    | 'Offer'
    | 'Accepted'
    | 'Rejected';
}