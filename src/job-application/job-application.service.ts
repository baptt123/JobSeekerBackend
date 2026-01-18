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
import { NotificationEntity } from '../entity/notification.entity';

@Injectable()
export class JobApplicationsService {
  private readonly JOB_EXPIRATION_DAYS = 120; // Thời hạn job

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly appRepo: Repository<JobApplicationEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(UserCVEntity)
    private readonly cvRepo: Repository<UserCVEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notiRepo: Repository<NotificationEntity>,
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  // --- 1. CHỨC NĂNG ỨNG TUYỂN ---
  async applyForJob(userId: number, dto: ApplyJobDto): Promise<JobApplicationEntity> {
    const { jobId, cvId, coverLetter } = dto;

    // A. Lấy thông tin Job
    const job = await this.jobRepo.findOne({
      where: { job_id: jobId },
      relations: ['postedBy', 'company'],
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy công việc này.');
    }

    // B. Kiểm tra Deadline
    const createdDate = new Date(job.created_at);
    const deadlineDate = new Date(createdDate);
    deadlineDate.setDate(createdDate.getDate() + this.JOB_EXPIRATION_DAYS);
    const now = new Date();

    if (now > deadlineDate) {
      // Logic ứng tuyển sau thời hạn
      throw new BadRequestException('Rất tiếc, công việc này đã hết hạn ứng tuyển.');
    }

    // C. Kiểm tra lịch sử ứng tuyển
    let application = await this.appRepo.findOne({
      where: { job_id: jobId, user_id: userId },
    });

    if (application) {
      // @ts-ignore
      if (application.status === 'Rejected') {
        // Cho phép ứng tuyển lại nếu đã hủy trước đó
        application.status = 'Applied';
        application.applied_at = new Date();
        application.cover_letter = coverLetter || application.cover_letter;
      } else if (['Rejected'].includes(application.status)) {
        throw new ConflictException('Hồ sơ của bạn đã từng bị từ chối cho vị trí này.');
      } else {
        throw new ConflictException('Bạn đã ứng tuyển công việc này rồi, vui lòng chờ phản hồi.');
      }
    } else {
      // Tạo mới
      application = this.appRepo.create({
        job_id: jobId,
        user_id: userId,
        status: 'Applied',
        applied_at: new Date(),
        cover_letter: coverLetter,
      });
    }

    // D. Validate CV
    if (cvId) {
      const selectedCv = await this.cvRepo.findOneBy({ cv_id: cvId, user_id: userId });
      if (!selectedCv) throw new ForbiddenException('CV không tồn tại hoặc không thuộc về bạn.');
      application.cv_id = selectedCv.cv_id;
    } else {
      const defaultCv = await this.cvRepo.findOneBy({ user_id: userId, is_default: true });
      if (!defaultCv) throw new BadRequestException('Vui lòng chọn CV hoặc đặt CV mặc định.');
      application.cv_id = defaultCv.cv_id;
    }

    const savedApp = await this.appRepo.save(application);

    // E. Gửi Thông Báo (DB + Firebase)
    await this.notifyRecruiter(job, userId, savedApp.application_id, 'APPLY');

    return savedApp;
  }

  // --- 2. CHỨC NĂNG HỦY ỨNG TUYỂN ---
  async cancelJobApplication(userId: number, jobId: number) {
    const application = await this.appRepo.findOne({
      where: { job_id: jobId, user_id: userId },
      relations: ['job', 'job.postedBy'],
    });

    if (!application) throw new NotFoundException('Bạn chưa ứng tuyển công việc này.');

    // Chỉ cho phép hủy khi trạng thái là 'Applied'
    if (application.status !== 'Applied') {
      if (application.status === 'Rejected') {
        throw new BadRequestException('Bạn đã hủy ứng tuyển công việc này rồi.');
      }
      throw new BadRequestException('Hồ sơ đang được xử lý hoặc đã có kết quả, không thể hủy lúc này.');
    }

    application.status = 'Rejected';
    const savedApp = await this.appRepo.save(application);

    // Gửi thông báo hủy
    await this.notifyRecruiter(application.job, userId, savedApp.application_id, 'CANCEL');

    return savedApp;
  }

  // --- Helper Gửi Thông Báo ---
  private async notifyRecruiter(job: JobEntity, candidateId: number, appId: number, type: 'APPLY' | 'CANCEL') {
    if (!job.postedBy?.user_id) return;

    const candidate = await this.userRepo.findOneBy({ user_id: candidateId });
    const name = candidate ? candidate.full_name : 'Một ứng viên';

    let title = '';
    let body = '';

    if (type === 'APPLY') {
      title = 'Hồ sơ ứng tuyển mới 📄';
      body = `${name} vừa ứng tuyển vào vị trí ${job.title}`;
    } else {
      title = 'Ứng viên hủy ứng tuyển ❌';
      body = `${name} đã rút hồ sơ khỏi vị trí ${job.title}`;
    }

    // 1. Lưu vào DB (Cho Web)
    try {
      await this.notiRepo.save({
        user: { user_id: job.postedBy.user_id } as UserEntity,
        title: title,
        message: body,
        is_read: false,
        created_at: new Date(),
        type: NotificationType.APPLICATION_UPDATE
      });
    } catch (e) { console.error("Lỗi lưu DB Noti", e); }

    // 2. Gửi Push Notification (Mobile)
    this.firebaseService.sendNotificationToUser(
      job.postedBy.user_id,
      title,
      body,
      NotificationType.APPLICATION_UPDATE,
      {
        click_action: 'RECRUITER_VIEW_APPLICATION',
        job_id: job.job_id.toString(),
        application_id: appId.toString(),
        type: type
      }
    ).catch(e => console.error("Lỗi gửi FCM", e));
  }
}