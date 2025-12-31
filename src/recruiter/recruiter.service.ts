import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException, // Thêm Exception này
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

// Entities
import { JobEntity } from '../entity/job.entity';
import { UserEntity } from '../entity/user.entity';
import { SkillEntity } from '../entity/skill.entity';
import { JobSkillEntity } from '../entity/job-skill.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { CompanyEntity } from '../entity/company.entity';
import {
  NotificationEntity,
  NotificationType,
} from '../entity/notification.entity';

// DTOs & Services
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';

@Injectable()
export class RecruiterService {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(SkillEntity)
    private readonly skillRepository: Repository<SkillEntity>,
    @InjectRepository(JobSkillEntity)
    private readonly jobSkillRepository: Repository<JobSkillEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepository: Repository<JobApplicationEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  // ... [GIỮ NGUYÊN CÁC HÀM createJob, handleJobNotification, getMyJobs, getJobDetail, getJobApplications] ...

  // --- 1. TẠO VIỆC LÀM MỚI ---
  async createJob(userId: number, dto: RecruiterCreateJobDto) {
    // ... (Giữ nguyên logic cũ)
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    try {
      const newJob = new JobEntity();
      newJob.title = dto.title;
      newJob.job_type = dto.job_type;
      newJob.location = dto.location;
      newJob.salary_min = dto.salary_min;
      newJob.salary_max = dto.salary_max;
      newJob.description = dto.description;
      newJob.requirements = dto.requirements;
      newJob.deadline = new Date(dto.deadline);

      newJob.postedBy = user;
      newJob.posted_by = user.user_id;
      if (user.company_id) newJob.company_id = user.company_id;

      const savedJob = await this.jobRepository.save(newJob);

      if (dto.skills && dto.skills.length > 0) {
        for (const skillName of dto.skills) {
          const cleanName = skillName.trim();
          let skill = await this.skillRepository.findOne({
            where: { skill_name: cleanName },
          });
          if (!skill) {
            skill = await this.skillRepository.save(
              this.skillRepository.create({ skill_name: cleanName }),
            );
          }
          await this.jobSkillRepository.save({
            job_id: savedJob.job_id,
            skill_id: skill.skill_id,
            is_required: true,
          });
        }
      }

      this.handleJobNotification(savedJob).catch((err) =>
        console.error('Lỗi gửi thông báo:', err),
      );

      return savedJob;
    } catch (error) {
      console.error('Create Job Error:', error);
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng tin');
    }
  }

  private async handleJobNotification(job: JobEntity) {
    // ... (Giữ nguyên logic cũ)
    const title = 'Cơ hội việc làm mới!';
    const body = `Công ty đang tuyển vị trí: ${job.title}. Xem ngay!`;
    const notiData = { job_id: job.job_id.toString(), type: 'NEW_JOB_POST' };

    await this.firebaseService.sendNotificationToTopic(
      'job_alerts',
      title,
      body,
      notiData,
    );

    const candidates = await this.userRepository.find({
      where: { role_id: 2 },
      select: ['user_id'],
    });

    if (candidates.length > 0) {
      const notifications = candidates.map((c) =>
        this.notificationRepository.create({
          user_id: c.user_id,
          title,
          message: body,
          type: NotificationType.NEW_JOB,
          metadata: notiData,
        }),
      );
      await this.notificationRepository.save(notifications);
    }
  }

  async getMyJobs(userId: number) {
    // ... (Giữ nguyên logic cũ)
    return await this.jobRepository.find({
      where: { posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });
  }

  async getJobDetail(userId: number, jobId: number) {
    // ... (Giữ nguyên logic cũ)
    return await this.jobRepository.findOne({
      where: { job_id: jobId, posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
    });
  }

  async getJobApplications(userId: number, jobId: number) {
    // ... (Giữ nguyên logic cũ)
    const job = await this.jobRepository.findOne({
      where: { job_id: jobId, posted_by: userId },
    });
    if (!job) throw new NotFoundException('Tin tuyển dụng không tồn tại');

    return await this.applicationRepository.find({
      where: { job_id: jobId },
      relations: ['user', 'cv'],
      order: { applied_at: 'DESC' },
    });
  }

  // --- 5. CẬP NHẬT TRẠNG THÁI HỒ SƠ ỨNG TUYỂN (LOGIC MỚI) ---
  async updateApplicationStatus(userId: number, appId: number, dto: UpdateApplicationStatusDto) {
    const application = await this.applicationRepository.findOne({
      where: { application_id: appId },
      relations: ['job', 'user'],
    });

    if (!application || application.job.posted_by !== userId) {
      throw new ForbiddenException('Bạn không có quyền xử lý hồ sơ này');
    }

    // [YÊU CẦU 1]: Chỉ được xử lý khi đang ở trạng thái chờ (Applied)
    // Nếu đã là Accepted hoặc Rejected (hoặc khác Applied) thì không cho sửa nữa
    if (application.status !== 'Applied') {
      throw new BadRequestException('Hồ sơ đã được xử lý, không thể thay đổi trạng thái.');
    }

    // [YÊU CẦU 1]: Chỉ được chọn "Xác nhận" hoặc "Từ chối"
    if (dto.status !== 'Accepted' && dto.status !== 'Rejected') {
      throw new BadRequestException('Trạng thái không hợp lệ. Chỉ chấp nhận "Accepted" hoặc "Rejected".');
    }

    // 1. Cập nhật DB
    application.status = dto.status;
    const result = await this.applicationRepository.save(application);

    // 2. Gửi thông báo (LOGIC QUYỀN TRUY CẬP)
    // Logic: Dựa vào việc User có fcm_token (đã cấp quyền ở frontend Flutter) hay không.
    // Hàm sendNotificationToUser trong FirebaseService đã xử lý logic này:
    // - Nếu có token -> Gửi Push + Lưu DB.
    // - Nếu không có token -> Chỉ lưu DB.

    let title = '';
    let body = '';

    if (dto.status === 'Accepted') {
      title = 'Hồ sơ được chấp nhận!';
      body = `Chúc mừng! Hồ sơ ứng tuyển vị trí "${application.job.title}" của bạn đã được nhà tuyển dụng xác nhận.`;
    } else {
      title = 'Kết quả ứng tuyển';
      body = `Rất tiếc, hồ sơ cho vị trí "${application.job.title}" của bạn chưa phù hợp vào lúc này.`;
    }

    this.firebaseService.sendNotificationToUser(
      application.user_id,
      title,
      body,
      NotificationType.APPLICATION_UPDATE,
      { job_id: application.job_id.toString(), status: dto.status }
    ).catch(err => console.error('Lỗi gửi thông báo ứng tuyển:', err));

    return result;
  }

  // ... [GIỮ NGUYÊN CÁC HÀM getRecruiterStats, getRecruiterChartData, updateCompanyProfile, getMyCompanyProfile] ...

  async getRecruiterStats(userId: number) {
    // ... (Giữ nguyên logic cũ)
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });
    if (!user) throw new NotFoundException('User not found');

    const totalJobs = await this.jobRepository.count({
      where: { posted_by: userId },
    });
    const totalApplications = await this.applicationRepository
      .createQueryBuilder('app')
      .innerJoin('app.job', 'job')
      .where('job.posted_by = :userId', { userId })
      .getCount();

    const activeJobs = await this.jobRepository.count({
      where: { posted_by: userId, deadline: MoreThan(new Date()) },
    });

    return {
      company: user.company?.name || 'Chưa cập nhật',
      stats: { totalJobs, totalApplications, activeJobs },
    };
  }

  async getRecruiterChartData(userId: number) {
    // ... (Giữ nguyên logic cũ)
    const labels: string[] = [];
    const dataMap = new Map<string, number>();
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`Tháng ${d.getMonth() + 1}`);
      dataMap.set(key, 0);
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const result = await this.applicationRepository
      .createQueryBuilder('app')
      .leftJoin('app.job', 'job')
      .select("DATE_FORMAT(app.applied_at, '%Y-%m')", 'month')
      .addSelect('COUNT(app.application_id)', 'count')
      .where('job.posted_by = :userId', { userId })
      .andWhere('app.applied_at >= :date', { date: sixMonthsAgo })
      .groupBy('month')
      .getRawMany();

    result.forEach((item) => {
      if (dataMap.has(item.month)) dataMap.set(item.month, Number(item.count));
    });

    return { labels, data: Array.from(dataMap.values()) };
  }

  async updateCompanyProfile(userId: number, dto: UpdateCompanyDto) {
    // ... (Giữ nguyên logic cũ)
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    if (!user?.company_id) throw new NotFoundException('Chưa liên kết công ty');

    await this.companyRepository.update(
      { company_id: user.company_id },
      {
        name: dto.name,
        description: dto.description,
        address: dto.address,
        website: dto.website,
        logo_url: dto.logo_url,
      },
    );
    return await this.companyRepository.findOne({
      where: { company_id: user.company_id },
    });
  }

  async getMyCompanyProfile(userId: number) {
    // ... (Giữ nguyên logic cũ)
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });
    return user?.company || null;
  }
}