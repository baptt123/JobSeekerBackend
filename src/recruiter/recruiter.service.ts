import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { SkillEntity } from '../entity/skill.entity';
import { JobSkillEntity } from '../entity/job-skill.entity';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';
import { NotificationType } from '../entity/notification.entity';
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';

@Injectable()
export class RecruiterService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly appRepo: Repository<JobApplicationEntity>,
    @InjectRepository(SkillEntity)
    private readonly skillRepo: Repository<SkillEntity>,
    @InjectRepository(JobSkillEntity)
    private readonly jobSkillRepo: Repository<JobSkillEntity>,

    // Inject Service thông báo
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  // 1. Dashboard thống kê của Recruiter
  async getRecruiterStats(userId: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    if (!user || !user.company) {
      throw new ForbiddenException(
        'Tài khoản này chưa được liên kết với công ty nào.',
      );
    }

    const companyId = user.company.company_id;

    // Đếm số job đang active
    const activeJobs = await this.jobRepo.count({
      where: { company_id: companyId },
    });

    // Đếm tổng số đơn ứng tuyển vào các job của công ty
    // (Query phức tạp hơn chút vì phải join qua bảng Jobs)
    const jobs = await this.jobRepo.find({
      where: { company_id: companyId },
      select: ['job_id'],
    });

    let totalApplications = 0;
    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.job_id);
      totalApplications = await this.appRepo
        .createQueryBuilder('app')
        .where('app.job_id IN (:...ids)', { ids: jobIds })
        .getCount();
    }

    return {
      company: user.company,
      stats: {
        activeJobs,
        totalApplications,
      },
    };
  }

  // 2. Đăng Job Mới
  async createJob(userId: number, dto: RecruiterCreateJobDto) {
    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    if (!user?.company) {
      throw new ForbiddenException(
        'Bạn phải thuộc một công ty để đăng tin tuyển dụng.',
      );
    }

    // A. Tạo Job Entity
    const newJob = this.jobRepo.create({
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      salary_min: dto.salary_min,
      salary_max: dto.salary_max,
      location: dto.location,
      job_type: dto.job_type,
      company: user.company, // Link với công ty
      postedBy: user, // Link với người đăng
      created_at: new Date(),
    });

    // Xử lý Deadline (Mặc định 30 ngày nếu không nhập)
    if (dto.deadline) {
      newJob.deadline = new Date(dto.deadline);
    } else {
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 30);
      newJob.deadline = defaultDeadline;
    }

    const savedJob = await this.jobRepo.save(newJob);

    // B. Xử lý Skills (Lưu vào bảng trung gian job_skills)
    if (dto.skills && dto.skills.length > 0) {
      for (const skillName of dto.skills) {
        // Tìm xem skill đã có trong DB chưa
        let skill = await this.skillRepo.findOneBy({ skill_name: skillName });

        // Nếu chưa có thì tạo mới skill đó
        if (!skill) {
          skill = await this.skillRepo.save(
            this.skillRepo.create({ skill_name: skillName }),
          );
        }

        // Lưu vào bảng job_skills
        await this.jobSkillRepo.save({
          job: savedJob,
          skill: skill,
          is_required: true, // Mặc định là bắt buộc
        });
      }
    }

    return savedJob;
  }

  // 3. Lấy danh sách Job của công ty mình
  async getMyJobs(userId: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    if (!user?.company) throw new ForbiddenException();

    return await this.jobRepo.find({
      where: { company_id: user.company.company_id },
      order: { created_at: 'DESC' },
      relations: ['applications'], // Để frontend hiển thị số lượng đơn
    });
  }

  // 4. Xem danh sách ứng viên của 1 Job cụ thể
  async getJobApplications(userId: number, jobId: number) {
    // Check quyền: Job này có phải của công ty Recruiter đang login không?
    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    const job = await this.jobRepo.findOne({
      where: { job_id: jobId },
      relations: ['company'],
    });

    if (!job) throw new NotFoundException('Công việc không tồn tại');

    // Nếu recruiter không có cty hoặc ID cty không khớp với job
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    if (!user.company || job.company.company_id !== user.company.company_id) {
      throw new ForbiddenException(
        'Bạn không có quyền xem đơn ứng tuyển của công việc này.',
      );
    }

    // Lấy danh sách Application kèm User và CV
    return await this.appRepo.find({
      where: { job_id: jobId },
      relations: ['user', 'cv'],
      order: { applied_at: 'DESC' },
    });
  }

  // 5. Cập nhật trạng thái Application (Duyệt/Loại)
  async updateApplicationStatus(
    userId: number,
    applicationId: number,
    dto: UpdateApplicationStatusDto,
  ) {
    // Lấy Application kèm Job info
    const application = await this.appRepo.findOne({
      where: { application_id: applicationId },
      relations: ['job', 'job.company', 'user'],
    });

    if (!application)
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');

    // Validate quyền: Recruiter phải thuộc cùng công ty với Job
    const recruiter = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    // ✅ FIX: Kiểm tra recruiter có tồn tại không trước
    if (!recruiter) {
      throw new ForbiddenException('User không tồn tại.');
    }

    // ✅ FIX: Kiểm tra recruiter có công ty không và so sánh ID
    if (
      !recruiter.company ||
      application.job.company.company_id !== recruiter.company.company_id
    ) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đơn này.');
    }

    // Cập nhật trạng thái
    application.status = dto.status;
    const updatedApp = await this.appRepo.save(application);

    // --- GỬI THÔNG BÁO CHO ỨNG VIÊN (QUAN TRỌNG) ---
    const candidateId = application.user.user_id;
    let notiTitle = 'Cập nhật trạng thái hồ sơ';
    let notiBody = `Hồ sơ cho vị trí ${application.job.title} đã chuyển sang trạng thái: ${dto.status}`;

    // Tùy chỉnh nội dung thông báo cho hay hơn
    if (dto.status === 'Interview') {
      notiTitle = 'Mời phỏng vấn! 🎉';
      notiBody = `Chúc mừng! Công ty ${application.job.company.name} muốn mời bạn phỏng vấn cho vị trí ${application.job.title}.`;
    } else if (dto.status === 'Rejected') {
      notiTitle = 'Thông báo từ nhà tuyển dụng';
      notiBody = `Rất tiếc, hồ sơ ứng tuyển vị trí ${application.job.title} của bạn chưa phù hợp vào lúc này.`;
    } else if (dto.status === 'Offer') {
      notiTitle = 'Chúc mừng! Bạn nhận được Offer 💌';
      notiBody = `Công ty ${application.job.company.name} đã gửi đề nghị làm việc cho bạn.`;
    }

    // Gọi Service Firebase bắn noti
    await this.firebaseService.sendNotificationToUser(
      candidateId,
      notiTitle,
      notiBody,
      NotificationType.APPLICATION_UPDATE,
      {
        click_action: 'APPLICATION_DETAIL', // Key để Flutter xử lý điều hướng
        job_id: application.job_id,
        application_id: application.application_id,
        new_status: dto.status,
      },
    );

    return updatedApp;
  }
}
