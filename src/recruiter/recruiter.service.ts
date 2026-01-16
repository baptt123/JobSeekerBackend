import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';

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

// SDK Gemini
const { GoogleGenAI } = require('@google/genai');

@Injectable()
export class RecruiterService {
  private aiClient: any;

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
    private readonly configService: ConfigService,
  ) {
    // Khởi tạo Gemini Client
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey: apiKey });
    }
  }

  // --- [NEW] TẠO NỘI DUNG JOB BẰNG GEMINI AI ---
  async generateJobContentWithAI(prompt: string) {
    if (!this.aiClient) {
      throw new InternalServerErrorException('Server chưa cấu hình GEMINI_API_KEY.');
    }

    const systemPrompt = `
      Bạn là chuyên gia nhân sự (HR Manager). Dựa trên yêu cầu ngắn gọn: "${prompt}", hãy soạn thảo nội dung tuyển dụng chuyên nghiệp bằng Tiếng Việt.
      
      Yêu cầu trả về định dạng JSON thuần túy (không markdown, không code block) với cấu trúc chính xác sau:
      {
        "title": "Tên vị trí công việc (ngắn gọn, hấp dẫn)",
        "description": "Mô tả công việc chi tiết (có gạch đầu dòng)",
        "requirements": "Yêu cầu ứng viên (kinh nghiệm, kỹ năng...)",
        "benefits": "Quyền lợi (lương, bảo hiểm, môi trường...)",
        "skills": ["kỹ năng 1", "kỹ năng 2", "kỹ năng 3"] (Mảng string chứa các kỹ năng chuyên môn/công nghệ chính)
      }
    `;

    try {
      const response = await this.aiClient.models.generateContent({
        model: "gemini-2.5-flash", // Hoặc gemini-1.5-flash
        contents: systemPrompt
      });

      let rawText = response.text || "";
      // Clean markdown json nếu AI trả về dạng ```json ... ```
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      return JSON.parse(rawText);
    } catch (error) {
      console.error('Gemini Job Gen Error:', error);
      throw new InternalServerErrorException('Không thể tạo nội dung từ AI. Vui lòng thử lại.');
    }
  }

  // --- 1. TẠO VIỆC LÀM MỚI ---
  async createJob(userId: number, dto: RecruiterCreateJobDto) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company']
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
      // Nếu entity có field benefits thì gán: newJob.benefits = dto.benefits;
      newJob.deadline = new Date(dto.deadline);

      newJob.postedBy = user;
      newJob.posted_by = user.user_id;
      if (user.company_id) newJob.company_id = user.company_id;

      const savedJob = await this.jobRepository.save(newJob);

      // Lưu Skills
      if (dto.skills && dto.skills.length > 0) {
        for (const skillName of dto.skills) {
          const cleanName = skillName.trim();
          if(!cleanName) continue;

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

      // [UPDATE] Gửi thông báo Job mới (Topic + Lưu DB)
      this.handleJobNotification(savedJob, user.company?.name || 'Công ty').catch((err) =>
        console.error('Lỗi gửi thông báo Job mới:', err),
      );

      return savedJob;
    } catch (error) {
      console.error('Create Job Error:', error);
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng tin');
    }
  }

  // Logic thông báo Job mới
  private async handleJobNotification(job: JobEntity, companyName: string) {
    const title = '🔥 Công việc mới!';
    const body = `${companyName} đang tuyển vị trí: ${job.title}. Xem ngay!`;
    const notiData = {
      job_id: job.job_id.toString(),
      type: 'NEW_JOB_POST',
      click_action: 'FLUTTER_NOTIFICATION_CLICK' // Hỗ trợ mobile click
    };

    // 1. Gửi Broadcast (Topic) cho thiết bị chưa đăng nhập hoặc đã đăng nhập
    await this.firebaseService.sendNotificationToTopic(
      'job_alerts',
      title,
      body,
      notiData,
    );

    // 2. Lưu vào DB cho tất cả Ứng viên (Role Candidate = 2)
    const candidates = await this.userRepository.find({
      where: { role_id: 2 },
      select: ['user_id'],
    });

    if (candidates.length > 0) {
      // Chunk insert nếu cần, ở đây map đơn giản
      const notifications = candidates.map((c) =>
        this.notificationRepository.create({
          user_id: c.user_id,
          title,
          message: body,
          type: NotificationType.NEW_JOB,
          metadata: notiData,
          is_read: false
        }),
      );
      await this.notificationRepository.save(notifications);
    }
  }

  async getMyJobs(userId: number) {
    return await this.jobRepository.find({
      where: { posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });
  }

  async getJobDetail(userId: number, jobId: number) {
    return await this.jobRepository.findOne({
      where: { job_id: jobId, posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
    });
  }

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

  // --- 5. CẬP NHẬT TRẠNG THÁI HỒ SƠ ỨNG TUYỂN (LOGIC ĐẦY ĐỦ) ---
  async updateApplicationStatus(userId: number, appId: number, dto: UpdateApplicationStatusDto) {
    const application = await this.applicationRepository.findOne({
      where: { application_id: appId },
      relations: ['job', 'user'],
    });

    if (!application || application.job.posted_by !== userId) {
      throw new ForbiddenException('Bạn không có quyền xử lý hồ sơ này');
    }

    if (application.status !== 'Applied') {
      throw new BadRequestException('Hồ sơ đã được xử lý trước đó, không thể thay đổi.');
    }

    if (dto.status !== 'Accepted' && dto.status !== 'Rejected') {
      throw new BadRequestException('Trạng thái không hợp lệ.');
    }

    // 1. Cập nhật DB
    application.status = dto.status;
    const result = await this.applicationRepository.save(application);

    // 2. Gửi thông báo (DB + Push)
    let title = '';
    let body = '';
    const jobTitle = application.job.title;

    if (dto.status === 'Accepted') {
      title = '🎉 Hồ sơ được chấp nhận!';
      body = `Chúc mừng! Hồ sơ ứng tuyển vị trí "${jobTitle}" của bạn đã được nhà tuyển dụng chấp nhận.`;
    } else {
      title = 'Kết quả ứng tuyển';
      body = `Cảm ơn bạn đã ứng tuyển vị trí "${jobTitle}". Rất tiếc hồ sơ của bạn chưa phù hợp vào lúc này.`;
    }

    // Hàm này trong FirebaseModuleService đã bao gồm logic:
    // - Luôn lưu Notification vào DB.
    // - Nếu user có fcm_token -> Gửi Push.
    // - Nếu không có token -> Chỉ lưu DB.
    this.firebaseService.sendNotificationToUser(
      application.user_id,
      title,
      body,
      NotificationType.APPLICATION_UPDATE,
      {
        job_id: application.job_id.toString(),
        application_id: application.application_id.toString(),
        status: dto.status,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    ).catch(err => console.error('Lỗi gửi thông báo ứng tuyển:', err));

    return result;
  }

  // ... Các hàm thống kê cũ giữ nguyên ...

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

  async updateCompanyProfile(userId: number, dto: UpdateCompanyDto) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    if (!user?.company_id) throw new NotFoundException('Chưa liên kết công ty');

    await this.companyRepository.update(
      { company_id: user.company_id },
      { ...dto },
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