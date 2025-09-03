import { IsNumber, IsEnum } from 'class-validator';

export class AcceptCandidateDto {
  @IsNumber()
  candidateId: string;
  @IsNumber()
  jobId: string;
  @IsEnum(['Screening', 'Interview', 'Offer', 'Accepted', 'Rejected'])
  status: string;
}
