import { IsNumber, IsEnum } from 'class-validator';

export class AcceptCandidateDto {
  @IsNumber()
  candidateId: number;
  @IsNumber()
  jobId: number;
  @IsEnum(['Screening', 'Interview', 'Offer', 'Accepted', 'Rejected'])
  status: string;
}
