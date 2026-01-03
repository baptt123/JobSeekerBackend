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
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';
import { ApplyJobDto } from '../dto/apply-job.dto';
import { UserEntity } from '../entity/user.entity';
import { NotificationType } from '../entity/notification.entity';

@Injectable()
export class JobApplicationsService {
  private readonly JOB_EXPIRATION_DAYS = 120;

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly appRepo: Repository<JobApplicationEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity)
    private readonly cvRepo: Repository<UserCVEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  async applyForJob(
    userId: number,
    dto: ApplyJobDto,
  ): Promise<JobApplicationEntity> {
    const { jobId, cvId, coverLetter } = dto;

    // --- 1. Lấy thông tin Job và Nhà tuyển dụng ---
    const job = await this.jobRepo.findOne({
      where: { job_id: jobId },
      relations: ['postedBy', 'company'],
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc này.');
    }

    // --- 2. Validate Deadline ---
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

    // Nếu đã từng hủy (Cancelled), cho phép ứng tuyển lại (Tùy chọn logic)
    // Nếu muốn chặn tuyệt đối thì giữ nguyên code cũ.
    // Ở đây tôi giữ nguyên logic cũ: Nếu có record bất kể trạng thái nào -> Báo lỗi.
    if (existingApplication) {
      // Nếu trạng thái là Cancelled thì có thể xóa record cũ hoặc update lại
      // Nhưng để an toàn và đơn giản, ta báo lỗi conflict
      throw new ConflictException('Bạn đã ứng tuyển công việc này rồi.');
    }

    // --- 4. Xử lý CV ---
    let selectedCv: UserCVEntity | null = null;

    if (cvId) {
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
      status: 'Applied', // Trạng thái khởi tạo chuẩn trong Entity
      applied_at: new Date(),
    });

    const savedApp = await this.appRepo.save(newApplication);

    // --- 6. Gửi Notification ---
    if (job.postedBy && job.postedBy.user_id) {
      const applicant = await this.userRepo.findOneBy({ user_id: userId });
      const applicantName = applicant ? applicant.full_name : 'Một ứng viên';

      const notiTitle = 'Hồ sơ ứng tuyển mới 📄';
      const notiBody = `${applicantName} vừa ứng tuyển vào vị trí ${job.title}`;

      this.firebaseService
        .sendNotificationToUser(
          job.postedBy.user_id,
          notiTitle,
          notiBody,
          NotificationType.APPLICATION_UPDATE,
          {
            click_action: 'RECRUITER_VIEW_APPLICATION',
            job_id: job.job_id,
            application_id: savedApp.application_id,
          },
        )
        .catch((err) => console.error('Lỗi gửi thông báo tuyển dụng:', err));
    }

    return savedApp;
  }

  // [HÀM MỚI] Xử lý hủy ứng tuyển
  async cancelJobApplication(userId: number, jobId: number) {
    const application = await this.appRepo.findOne({
      where: { job_id: jobId, user_id: userId },
    });

    if (!application) {
      throw new NotFoundException('Bạn chưa ứng tuyển công việc này.');
    }

    // [FIX] Sửa logic so sánh: Dùng 'Applied' thay vì 'Pending'
    // 'Applied' là trạng thái mặc định khi vừa nộp đơn trong Entity của bạn.
    if (application.status !== 'Applied') {
      throw new BadRequestException(
        'Không thể hủy đơn khi hồ sơ đã được duyệt hoặc từ chối.',
      );
    }

    // [FIX] Gán trạng thái 'Cancelled'.
    // Bây giờ hợp lệ vì đã update Entity.
    application.status = 'Cancelled';

    return await this.appRepo.save(application);
  }
}