import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { JobApplicationService } from './job-application.service';
import { AcceptCandidateDto } from '../dto/accept-candidate.dto';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';
import { CreateJobApplicationDto } from '../dto/create-job-application.dto';

@Controller('job-application')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationService) {}

  @Roles('USER')
  @UseGuards(RolesGuard)
  @Put()
  public async updateStatusJobApplications(
    acceptCandidateDTO: Partial<AcceptCandidateDto>,
  ): Promise<JobApplicationEntity | null> {
    return await this.jobApplicationService.acceptApplication(
      acceptCandidateDTO,
    );
  }
  @Roles('USER')
  @UseGuards(RolesGuard)
  @Put('apply')
  async apply(
    @Body() dto: CreateJobApplicationDto, // Lấy user id từ token nếu muốn bảo mật
  ) {
    return await this.jobApplicationService.apply({
      ...dto, // ép lấy user id thực tế từ token
    });
  }
}
