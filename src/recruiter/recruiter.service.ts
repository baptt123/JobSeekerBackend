import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm'; //
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

import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';
import { createPartFromUri, GoogleGenAI } from "@google/genai";

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
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey: apiKey });
    }
  }

  // --- THỐNG KÊ DASHBOARD (CẬP NHẬT) ---
  async getRecruiterStats(userId: number) {
    const user = await this.userRepository.findOne({ where: { user_id: userId }, relations: ['company'] });
    const totalJobs = await this.jobRepository.count({ where: { posted_by: userId } });

    // Đếm tổng số đơn ứng tuyển
    const totalApplications = await this.applicationRepository.createQueryBuilder('app')
      .innerJoin('app.job', 'job')
      .where('job.posted_by = :userId', { userId })
      .getCount();

    const activeJobs = await this.jobRepository.count({ where: { posted_by: userId, deadline: MoreThan(new Date()) } });

    return {
      company: user?.company?.name || 'Công ty',
      stats: { totalJobs, totalApplications, activeJobs }
    };
  }

  // --- [NEW] HÀM LẤY DỮ LIỆU BIỂU ĐỒ THEO THÁNG ---
  async getRecruiterChartData(userId: number) {
    // 1. Xác định khoảng thời gian: 6 tháng gần nhất
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5); // Lấy 6 mốc tháng
    sixMonthsAgo.setDate(1); // Ngày đầu tháng

    // 2. Lấy dữ liệu thô từ DB
    const rawData = await this.applicationRepository.createQueryBuilder('app')
      .select("MONTH(app.applied_at)", "month")
      .addSelect("YEAR(app.applied_at)", "year")
      .addSelect("COUNT(app.application_id)", "count")
      .innerJoin("app.job", "job")
      .where("job.posted_by = :userId", { userId })
      .andWhere("app.applied_at >= :date", { date: sixMonthsAgo })
      .groupBy("year, month")
      .orderBy("year", "ASC")
      .addOrderBy("month", "ASC")
      .getRawMany();

    // 3. Chuẩn hóa dữ liệu (Điền số 0 cho tháng thiếu)
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(today.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      // Label hiển thị: "Tháng 12/2025"
      labels.push(`Tháng ${m}/${y}`);

      // Tìm trong rawData xem có dữ liệu không
      const found = rawData.find(item =>
        parseInt(item.month) === m && parseInt(item.year) === y
      );

      data.push(found ? parseInt(found.count) : 0);
    }

    return { labels, data };
  }

  async getMyCompanyProfile(userId: number) {
    const user = await this.userRepository.findOne({ where: { user_id: userId }, relations: ['company'] });
    return user?.company;
  }
  async updateCompanyProfile(userId: number, dto: any) {
    const user = await this.userRepository.findOne({ where: { user_id: userId } });
    // @ts-ignore
    await this.companyRepository.update({ company_id: user.company_id }, dto);
    // @ts-ignore
    return this.companyRepository.findOne({ where: { company_id: user.company_id } });
  }

  async getMyJobs(userId: number) {
    return this.jobRepository.find({
      where: { posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });
  }

  async getJobDetail(userId: number, jobId: number) {
    return this.jobRepository.findOne({
      where: { job_id: jobId, posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
    });
  }

  async getJobApplications(userId: number, jobId: number) {
    const job = await this.jobRepository.findOne({ where: { job_id: jobId, posted_by: userId } });
    if (!job) throw new NotFoundException('Không tìm thấy job');
    return this.applicationRepository.find({
      where: { job_id: jobId },
      relations: ['user', 'cv'],
      order: { applied_at: 'DESC' },
    });
  }

  async generateJobContentWithAI(prompt: string) {
    if (!this.aiClient) {
      throw new InternalServerErrorException('Server chưa cấu hình GEMINI_API_KEY.');
    }

    const systemPrompt = `
      Bạn là chuyên gia nhân sự. Dựa trên yêu cầu: "${prompt}", hãy soạn nội dung tuyển dụng Tiếng Việt.
      Trả về JSON thuần túy (không markdown) với cấu trúc:
      {
        "title": "Tên công việc",
        "description": "Mô tả chi tiết",
        "requirements": "Yêu cầu",
        "benefits": "Quyền lợi",
        "skills": ["Skill1", "Skill2"],
        "salary_min": 15000000,
        "salary_max": 25000000
      }
      Lưu ý: salary_min và salary_max phải là số nguyên (VNĐ), không có số thập phân.
    `;

    try {
      const response = await this.aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt
      });

      let rawText = response.text || "";
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(rawText);
    } catch (error) {
      console.error('Gemini Job Gen Error:', error);
      throw new InternalServerErrorException('Không thể tạo nội dung từ AI.');
    }
  }

  async analyzeCvMatch(applicationId: number): Promise<string> {
    const application = await this.applicationRepository.findOne({
      where: { application_id: applicationId },
      relations: ['job', 'cv'],
    });

    if (!application || !application.cv || !application.cv.file_url) {
      throw new NotFoundException('Không tìm thấy CV.');
    }

    if (!this.aiClient) throw new InternalServerErrorException('Quên thông tin mật ');

    const cvUrl = application.cv.file_url;
    const jobRequirements = application.job.requirements || "Không có yêu cầu cụ thể";

    try {
      const pdfBuffer = await fetch(cvUrl).then(res => res.arrayBuffer());
      const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

      const file = await this.aiClient.files.upload({
        file: fileBlob,
        config: { displayName: `CV_${applicationId}.pdf` },
      });

      let getFile = await this.aiClient.files.get({ name: file.name });
      while (getFile.state === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        getFile = await this.aiClient.files.get({ name: file.name });
      }

      if (getFile.state === 'FAILED') throw new Error('Xử lí file bị lỗi');

      const prompt = `
        Đóng vai trò nhà tuyển dụng.
        1. Trích xuất kỹ năng từ CV đính kèm.
        2. So sánh với yêu cầu: "${jobRequirements}".
        3. Trả về HTML ngắn gọn (không markdown, không thẻ html/body):
        <ul class="space-y-1 text-sm">
          <li><strong>Độ phù hợp:</strong> [Cao/Trung bình/Thấp]</li>
          <li class="text-green-600"><strong><i class="fas fa-check"></i> Điểm mạnh:</strong> ...</li>
          <li class="text-red-600"><strong><i class="fas fa-times"></i> Điểm thiếu:</strong> ...</li>
        </ul>
      `;

      const content: any[] = [prompt];
      if (file.uri && file.mimeType) {
        content.push(createPartFromUri(file.uri, file.mimeType));
      }

      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
      });

      const result = response.text;

      application.ai_match_analysis = result;
      await this.applicationRepository.save(application);

      return result;

    } catch (error) {
      console.error('Analyze CV Error:', error);
      return '<span class="text-red-500">Lỗi phân tích CV.</span>';
    }
  }

  async createJob(userId: number, dto: RecruiterCreateJobDto) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company']
    });
    if (!user) throw new NotFoundException('Người dùng không tìm thấy');

    const newJob = new JobEntity();
    Object.assign(newJob, dto); // Map fields

    newJob.salary_min = Math.floor(dto.salary_min);
    newJob.salary_max = Math.floor(dto.salary_max);

    newJob.created_at = new Date(dto.created_at);
    newJob.postedBy = user;
    newJob.posted_by = user.user_id;
    if (user.company_id) newJob.company_id = user.company_id;

    const savedJob = await this.jobRepository.save(newJob);

    if (dto.skills && dto.skills.length > 0) {
      for (const skillName of dto.skills) {
        const cleanName = skillName.trim();
        if(!cleanName) continue;
        let skill = await this.skillRepository.findOne({ where: { skill_name: cleanName } });
        if (!skill) skill = await this.skillRepository.save({ skill_name: cleanName });

        await this.jobSkillRepository.save({
          job_id: savedJob.job_id,
          skill_id: skill.skill_id,
          is_required: true,
        });
      }
    }

    this.handleJobNotification(savedJob, user.company?.name || 'Công ty').catch(e => console.error(e));
    return savedJob;
  }

  private async handleJobNotification(job: JobEntity, companyName: string) {
    const title = '🔥 Công việc mới!';
    const body = `${companyName} đang tuyển: ${job.title}`;
    const notiData = {
      job_id: job.job_id.toString(),
      type: 'NEW_JOB_POST',
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    };

    await this.firebaseService.sendNotificationToTopic('job_alerts', title, body, notiData);

    const candidates = await this.userRepository.find({ where: { role_id: 2 }, select: ['user_id'] });
    if (candidates.length) {
      const notis = candidates.map(c => this.notificationRepository.create({
        user_id: c.user_id, title, message: body, type: NotificationType.NEW_JOB, metadata: notiData, is_read: false
      }));
      await this.notificationRepository.save(notis);
    }
  }

  async updateApplicationStatus(userId: number, appId: number, dto: UpdateApplicationStatusDto) {
    const app = await this.applicationRepository.findOne({ where: { application_id: appId }, relations: ['job', 'user'] });
    if (!app || app.job.posted_by !== userId) throw new ForbiddenException('Access denied');

    if (app.status !== 'Applied') {
      throw new BadRequestException('Hồ sơ đã được xử lý trước đó.');
    }

    if (dto.status !== 'Accepted' && dto.status !== 'Rejected') {
      throw new BadRequestException('Trạng thái không hợp lệ.');
    }

    app.status = dto.status;
    const res = await this.applicationRepository.save(app);

    const title = dto.status === 'Accepted' ? 'Hồ sơ được duyệt!' : 'Kết quả ứng tuyển';
    const body = dto.status === 'Accepted'
      ? `Chúc mừng! Bạn đã đậu vị trí ${app.job.title}`
      : `Rất tiếc, bạn chưa phù hợp với vị trí ${app.job.title}`;

    this.firebaseService.sendNotificationToUser(
      app.user_id, title, body, NotificationType.APPLICATION_UPDATE,
      { job_id: app.job_id.toString(), application_id: app.application_id.toString(), status: dto.status }
    ).catch(e => console.error(e));

    return res;
  }

}