import { Injectable } from '@nestjs/common';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { Repository } from 'typeorm';
import { AcceptCandidateDto } from '../dto/accept-candidate.dto';

@Injectable()
export class JobApplicationService {
  constructor(
    @Injectable(JobApplicationEntity)
    private readonly jobApplicationEntity: Repository<JobApplicationEntity>,
  ) {} // Giả sử bạn dùng TypeORM với repository được inject là jobApplicationEntity

  public async acceptApplication(
    jobApplicationDTO: Partial<AcceptCandidateDto>,
  ): Promise<JobApplicationEntity | null> {
    // Lấy ra ứng tuyển cùng quan hệ công việc và người dùng
    const jobApplication = await this.jobApplicationEntity.findOne({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: jobApplicationDTO.jobId, user_id: jobApplicationDTO.userId },
      relations: ['job', 'user'], // cần thiết để lấy thông tin Job và User liên quan
    });

    if (!jobApplication) {
      return null;
    }

    // // Lấy ra công việc
    // const jobInfo = jobApplication.job; // hoặc có thể lấy từ repository: await jobsRepo.findOne({ id: jobApplication.job_id })
    //
    // // Lấy ra thông tin user
    // const userInfo = jobApplication.user; // hoặc từ usersRepo: await usersRepo.findOne({ id: jobApplication.user_id })

    // Thay đổi trạng thái
    jobApplication.status = 'Accepted';

    // Lưu lại
    // Có thể trả về luôn jobApplication (đã chứa job và user nếu dùng relations)
    return await this.jobApplicationEntity.save(jobApplication);
  }
}
