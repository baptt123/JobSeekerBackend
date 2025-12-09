// src/recruiter/recruiter.service.ts

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
import { UserCVEntity } from '../entity/user-cv.entity'; // [MỚI] Import để query CV
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
    @InjectRepository(UserCVEntity) // [MỚI] Inject CV Repository
    private readonly cvRepo: Repository<UserCVEntity>,

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

  // 2. Đăng Job Mới (Kèm logic gửi thông báo tìm ứng viên)
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
      company: user.company,
      postedBy: user,
      created_at: new Date(),
    });

    // Xử lý Deadline
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
        let skill = await this.skillRepo.findOneBy({ skill_name: skillName });

        if (!skill) {
          skill = await this.skillRepo.save(
            this.skillRepo.create({ skill_name: skillName }),
          );
        }

        await this.jobSkillRepo.save({
          job: savedJob,
          skill: skill,
          is_required: true,
        });
      }

      // [MỚI] Gọi hàm gửi thông báo cho các ứng viên phù hợp
      // Chạy không await để không block response của API
      this.notifyMatchingCandidates(savedJob, dto.skills).catch((err) =>
        console.error('Lỗi gửi thông báo Job matching:', err),
      );
    }

    return savedJob;
  }

  // [MỚI] Hàm phụ trợ: Tìm và gửi thông báo cho ứng viên phù hợp
  private async notifyMatchingCandidates(job: JobEntity, skills: string[]) {
    if (!skills || skills.length === 0) return;

    try {
      // 1. Tìm các User có CV chứa từ khóa skill tương ứng
      // Query này join qua bảng keywords của CV để tìm match
      const matchingCvs = await this.cvRepo
        .createQueryBuilder('cv')
        .leftJoin('cv.keywords', 'cvKeyword')
        .leftJoin('cvKeyword.keyword', 'keyword')
        .leftJoinAndSelect('cv.user', 'user')
        .where('cv.is_default = :isDefault', { isDefault: true }) // Chỉ xét CV chính
        .andWhere('keyword.keyword_name IN (:...skills)', { skills })
        .select(['cv.cv_id', 'user.user_id', 'user.fcm_token']) // Chỉ lấy thông tin cần thiết
        .distinct(true) // Tránh gửi nhiều lần cho 1 user nếu khớp nhiều skill
        .getMany();

      console.log(
        `[Job Matching] Tìm thấy ${matchingCvs.length} ứng viên phù hợp cho job ${job.job_id}`,
      );

      // 2. Gửi thông báo
      for (const cv of matchingCvs) {
        // Bỏ qua nếu là chính người đăng (trường hợp test)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (cv.user.user_id === job.postedBy.user_id) continue;

        await this.firebaseService.sendNotificationToUser(
          cv.user.user_id,
          'Có việc làm mới phù hợp! 💼',
          `Công việc "${job.title}" tại ${job.company.name} phù hợp với kỹ năng của bạn.`,
          NotificationType.NEW_JOB,
          {
            click_action: 'JOB_DETAIL',
            job_title: job.title, // Flutter có thể dùng title để fetch detail
            job_id: job.job_id,
          },
        );
      }
    } catch (e) {
      console.error('Lỗi trong quá trình notifyMatchingCandidates:', e);
    }
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
      relations: ['applications'],
    });
  }

  // 4. Xem danh sách ứng viên của 1 Job cụ thể
  async getJobApplications(userId: number, jobId: number) {
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

    return await this.appRepo.find({
      where: { job_id: jobId },
      relations: ['user', 'cv'],
      order: { applied_at: 'DESC' },
    });
  }

  // 5. Cập nhật trạng thái Application & Gửi thông báo
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

    if (!recruiter) {
      throw new ForbiddenException('User không tồn tại.');
    }

    if (
      !recruiter.company ||
      application.job.company.company_id !== recruiter.company.company_id
    ) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đơn này.');
    }

    // Cập nhật trạng thái
    application.status = dto.status;
    const updatedApp = await this.appRepo.save(application);

    // [MỚI] --- GỬI THÔNG BÁO CHO ỨNG VIÊN ---
    const candidateId = application.user.user_id;
    let notiTitle = 'Cập nhật trạng thái hồ sơ';
    let notiBody = `Hồ sơ cho vị trí ${application.job.title} đã chuyển sang trạng thái: ${dto.status}`;

    // Tùy chỉnh nội dung thông báo cho hay hơn
    switch (dto.status) {
      case 'Interview':
        notiTitle = 'Mời phỏng vấn! 📅';
        notiBody = `Chúc mừng! ${application.job.company.name} muốn hẹn lịch phỏng vấn với bạn cho vị trí ${application.job.title}.`;
        break;
      case 'Offer':
        notiTitle = 'Bạn nhận được Offer! 🎉';
        notiBody = `Tuyệt vời! Bạn đã nhận được lời mời làm việc từ ${application.job.company.name}.`;
        break;
      case 'Rejected':
        notiTitle = 'Thông báo từ nhà tuyển dụng';
        notiBody = `Rất tiếc, hồ sơ ứng tuyển vị trí ${application.job.title} của bạn chưa phù hợp vào lúc này.`;
        break;
      case 'Accepted':
        notiTitle = 'Chào mừng gia nhập! 🤝';
        notiBody = `Bạn đã chính thức trở thành thành viên của ${application.job.company.name}.`;
        break;
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

  // 6. Lấy dữ liệu biểu đồ
  async getRecruiterChartData(userId: number) {
    const rawData = await this.appRepo
      .createQueryBuilder('app')
      .select('app.status', 'status')
      .addSelect('COUNT(app.application_id)', 'count')
      .leftJoin('app.job', 'job')
      .where('job.posted_by = :userId', { userId })
      .groupBy('app.status')
      .getRawMany();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
    const labels = rawData.map((item) => item.status);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = rawData.map((item) => Number(item.count));

    if (labels.length === 0) {
      return {
        labels: ['No Data'],
        data: [0],
      };
    }

    return {
      labels,
      data,
    };
  }
}
