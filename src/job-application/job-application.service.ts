import { Injectable } from '@nestjs/common';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { Repository } from 'typeorm';
import { AcceptCandidateDto } from '../dto/accept-candidate.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateJobApplicationDto } from '../dto/create-job-application.dto';
import { GlobalExceptionFilter } from '../filter/global-exception.filter';

@Injectable()
export class JobApplicationService {
  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly jobApplicationEntity: Repository<JobApplicationEntity>,
  ) {}
  async apply(dto: CreateJobApplicationDto): Promise<JobApplicationEntity> {
    const exists = await this.jobApplicationEntity.findOne({
      where: {
        job: { job_id: dto.jobId },
        user: { user_id: dto.userId },
      },
    });

    if (exists) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new GlobalExceptionFilter();
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const application = this.jobApplicationEntity.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      job: { jobId: dto.jobId } as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: { userId: dto.userId } as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      cv: dto.cvId ? ({ cvId: dto.cvId } as any) : null,
      coverLetter: dto.coverLetter,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return await this.jobApplicationEntity.save(application);
  }
  public async acceptApplication(
    jobApplicationDTO: Partial<AcceptCandidateDto>,
  ): Promise<JobApplicationEntity | null> {
    // TÌM ứng viên bằng job_id, user_id
    const jobApplication = await this.jobApplicationEntity.findOne({
      where: {
        job: { job_id: jobApplicationDTO.jobId }, // Dùng job_id vì JobEntity có @PrimaryGeneratedColumn() job_id
        user: { user_id: jobApplicationDTO.candidateId }, // user_id vì UserEntity có @PrimaryGeneratedColumn() user_id
      },
      relations: ['job', 'user'],
    });
    if (!jobApplication) {
      return null;
    }
    // Đổi trạng thái sang Accepted
    jobApplication.status = 'Accepted';
    // Cập nhật lên DB
    return await this.jobApplicationEntity.save(jobApplication);
  }
}
