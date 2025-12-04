import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service'; // Import Service Notification
import { ApplyJobDto } from '../dto/apply-job.dto';
import { UserEntity } from '../entity/user.entity';
import { NotificationType } from '../entity/notification.entity';

@Injectable()
export class JobApplicationsService {
  private readonly JOB_EXPIRATION_DAYS = 30;

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly appRepo: Repository<JobApplicationEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity)
    private readonly cvRepo: Repository<UserCVEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    // Inject Notification Service
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  async applyForJob(
    userId: number,
    dto: ApplyJobDto,
  ): Promise<JobApplicationEntity> {
    const { jobId, cvId, coverLetter } = dto;

    // --- 1. Lấy thông tin Job và Nhà tuyển dụng (để gửi thông báo sau này) ---
    const job = await this.jobRepo.findOne({
      where: { job_id: jobId },
      relations: ['postedBy', 'company'], // Join để lấy thông tin người đăng (Recruiter)
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc này.');
    }

    // --- 2. Validate Deadline (30 ngày) ---
    const createdDate = new Date(job.created_at);
    const deadlineDate = new Date(createdDate);
    deadlineDate.setDate(createdDate.getDate() + this.JOB_EXPIRATION_DAYS);

    if (new Date() > deadlineDate) {
      throw new BadRequestException('Công việc này đã hết hạn ứng tuyển.');
    }

    // --- 3. Validate đã ứng tuyển chưa ---
    const existingApplication = await this.appRepo.findOneBy({
      job_id: jobId,
      user_id: userId,
    });

    if (existingApplication) {
      throw new ConflictException('Bạn đã ứng tuyển công việc này rồi.');
    }

    // --- 4. Xử lý CV (Quan trọng) ---
    let selectedCv: UserCVEntity | null = null;

    if (cvId) {
      // Nếu user chọn CV cụ thể -> Kiểm tra CV đó có phải của user không
      selectedCv = await this.cvRepo.findOneBy({
        cv_id: cvId,
        user_id: userId,
      });
      if (!selectedCv) {
        throw new ForbiddenException(
          'CV không tồn tại hoặc không thuộc về bạn.',
        );
      }
    } else {
      // Nếu không chọn -> Lấy CV mặc định
      selectedCv = await this.cvRepo.findOneBy({
        user_id: userId,
        is_default: true,
      });
      if (!selectedCv) {
        throw new BadRequestException(
          'Vui lòng chọn một CV hoặc đặt CV mặc định trước khi ứng tuyển.',
        );
      }
    }

    // --- 5. Tạo Application ---
    const newApplication = this.appRepo.create({
      job_id: jobId,
      user_id: userId,
      cv_id: selectedCv.cv_id,
      cover_letter: coverLetter,
      status: 'Applied',
      applied_at: new Date(),
    });

    const savedApp = await this.appRepo.save(newApplication);

    // --- 6. Gửi Notification cho Nhà tuyển dụng (Recruiter) ---
    // Chỉ gửi nếu job có người đăng (postedBy tồn tại)
    if (job.postedBy && job.postedBy.user_id) {
      // Lấy tên ứng viên để thông báo đẹp hơn
      const applicant = await this.userRepo.findOneBy({ user_id: userId });
      const applicantName = applicant ? applicant.full_name : 'Một ứng viên';

      // Nội dung thông báo
      const notiTitle = 'Hồ sơ ứng tuyển mới 📄';
      const notiBody = `${applicantName} vừa ứng tuyển vào vị trí ${job.title}`;

      // Gọi service bắn thông báo (Hàm này đã có logic tự tìm token + lưu DB)
      // Chúng ta không dùng await để tránh việc ứng viên phải chờ thông báo gửi xong mới nhận phản hồi
      this.firebaseService
        .sendNotificationToUser(
          job.postedBy.user_id,
          notiTitle,
          notiBody,
          NotificationType.APPLICATION_UPDATE, // Hoặc loại type phù hợp
          {
            click_action: 'RECRUITER_VIEW_APPLICATION', // Để Flutter điều hướng
            job_id: job.job_id,
            application_id: savedApp.application_id,
          },
        )
        .catch((err) => console.error('Lỗi gửi thông báo tuyển dụng:', err));
    }

    return savedApp;
  }
}
