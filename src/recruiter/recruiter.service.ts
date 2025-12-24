import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
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

  // --- 1. TẠO VIỆC LÀM MỚI ---
  async createJob(userId: number, dto: RecruiterCreateJobDto) {
    // Lấy thông tin Recruiter đang đăng nhập để gán ID và Company ID chính xác
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

      // Gán ID của Recruiter hiện tại, không dùng ID mặc định
      newJob.postedBy = user;
      newJob.posted_by = user.user_id;
      if (user.company_id) newJob.company_id = user.company_id;

      const savedJob = await this.jobRepository.save(newJob);

      // Xử lý lưu kỹ năng (Skills) yêu cầu cho công việc
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

      // Xử lý gửi thông báo ngầm cho toàn bộ ứng viên về việc làm mới
      this.handleJobNotification(savedJob).catch((err) =>
        console.error('Lỗi gửi thông báo:', err),
      );

      return savedJob;
    } catch (error) {
      console.error('Create Job Error:', error);
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng tin');
    }
  }

  // Hàm hỗ trợ gửi thông báo FCM và lưu lịch sử thông báo vào Database
  private async handleJobNotification(job: JobEntity) {
    const title = 'Cơ hội việc làm mới!';
    const body = `Công ty đang tuyển vị trí: ${job.title}. Xem ngay!`;
    const notiData = { job_id: job.job_id.toString(), type: 'NEW_JOB_POST' };

    // Gửi FCM tới topic chung của ứng viên
    await this.firebaseService.sendNotificationToTopic(
      'job_alerts',
      title,
      body,
      notiData,
    );

    // Lưu thông báo vào Database cho tất cả tài khoản ứng viên (Role ID = 2)
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

  // --- 2. LẤY DANH SÁCH VIỆC LÀM CỦA TÔI ---
  async getMyJobs(userId: number) {
    return await this.jobRepository.find({
      where: { posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });
  }

  // --- 3. LẤY CHI TIẾT VIỆC LÀM ---
  async getJobDetail(userId: number, jobId: number) {
    return await this.jobRepository.findOne({
      where: { job_id: jobId, posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
    });
  }

  // --- 4. LẤY DANH SÁCH HỒ SƠ ỨNG TUYỂN THEO TIN ---
  async getJobApplications(userId: number, jobId: number) {
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

  // --- 5. CẬP NHẬT TRẠNG THÁI HỒ SƠ ỨNG TUYỂN ---
  async updateApplicationStatus(
    userId: number,
    appId: number,
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.applicationRepository.findOne({
      where: { application_id: appId },
      relations: ['job'],
    });

    if (!application || application.job.posted_by !== userId) {
      throw new ForbiddenException('Bạn không có quyền xử lý hồ sơ này');
    }

    application.status = dto.status;
    return await this.applicationRepository.save(application);
  }

  // --- 6. THỐNG KÊ DASHBOARD ---
  async getRecruiterStats(userId: number) {
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

  // --- 7. DỮ LIỆU BIỂU ĐỒ 6 THÁNG ---
  async getRecruiterChartData(userId: number) {
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

  // --- 8. CẬP NHẬT & LẤY THÔNG TIN CÔNG TY ---
  async updateCompanyProfile(userId: number, dto: UpdateCompanyDto) {
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
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });
    return user?.company || null;
  }
}
