import { Controller, Put } from '@nestjs/common';
import { JobApplicationService } from './job-application.service';
import { AcceptCandidateDto } from '../dto/accept-candidate.dto';
import { JobApplicationEntity } from '../entity/job-application.entity';

@Controller('job-application')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationService) {}

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @Roles('USER')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @UseGuards(RolesGuard)
  @Put()
  public async updateStatusJobApplications(
    acceptCandidateDTO: Partial<AcceptCandidateDto>,
  ): Promise<JobApplicationEntity | void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
    return await this.jobApplicationService.updateStatusJobApplications(
      acceptCandidateDTO,
    );
  }
}
