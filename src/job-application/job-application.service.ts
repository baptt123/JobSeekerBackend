import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from 'src/entity/user-cv.entity';

@Injectable()
export class JobApplicationsService {
  // Giả định thời hạn ứng tuyển là 30 ngày kể từ ngày đăng
  private readonly JOB_EXPIRATION_DAYS = 30;

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly appRepo: Repository<JobApplicationEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity)
    private readonly cvRepo: Repository<UserCVEntity>,
  ) {}

  async applyForJob(
    userId: number,
    jobId: number,
  ): Promise<JobApplicationEntity> {
    // --- Bước 1: Tìm công việc ---
    const job = await this.jobRepo.findOneBy({ job_id: jobId });
    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc này.');
    }

    // --- Bước 2: Kiểm tra thời gian (Check 1) ---
    // "kiểm tra thời gian hiện tại so với ngày được tạo"
    const now = new Date();
    const jobCreatedAt = job.created_at;
    const expiryDate = new Date(jobCreatedAt);
    expiryDate.setDate(expiryDate.getDate() + this.JOB_EXPIRATION_DAYS);

    if (now > expiryDate) {
      throw new BadRequestException('Công việc này đã hết hạn ứng tuyển.');
    }

    // --- Bước 3: Kiểm tra đã ứng tuyển chưa (Check 2) ---
    // "kiểm tra tiếp xem đã ứng tuyển chưa"
    const existingApplication = await this.appRepo.findOneBy({
      job_id: jobId,
      user_id: userId,
    });

    if (existingApplication) {
      // "nếu rồi thì làm sao đó" -> Ném lỗi
      throw new ConflictException('Bạn đã ứng tuyển công việc này rồi.');
    }

    // --- Bước 4: Tìm CV mặc định của người dùng ---
    // (Logic thêm: Một đơn ứng tuyển cần có CV)
    const defaultCv = await this.cvRepo.findOneBy({
      user_id: userId,
      is_default: true,
    });

    if (!defaultCv) {
      throw new BadRequestException(
        'Vui lòng tải lên CV và đặt làm mặc định trước khi ứng tuyển.',
      );
    }

    // --- Bước 5: Tạo đơn ứng tuyển mới (nếu chưa) ---
    // "nếu chưa thì xác nhận"
    const newApplication = this.appRepo.create({
      job_id: jobId,
      user_id: userId,
      cv_id: defaultCv.cv_id, // Gắn CV mặc định vào [cite: 28]
      status: 'Applied', // Trạng thái ban đầu [cite: 30]
      applied_at: new Date(),
    });

    return this.appRepo.save(newApplication);
  }
}
