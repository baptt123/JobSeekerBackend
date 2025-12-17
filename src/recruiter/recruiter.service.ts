import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm'; // <--- Nhớ import MoreThan

// Entities
import { JobEntity } from '../entity/job.entity';
import { UserEntity } from '../entity/user.entity';
import { SkillEntity } from '../entity/skill.entity';
import { JobSkillEntity } from '../entity/job-skill.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';

// DTOs
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { CompanyEntity } from '../entity/company.entity';
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';

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
  ) {}

  // --- 1. CREATE JOB ---
  async createJob(userId: number, dto: RecruiterCreateJobDto) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

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

      // Quan hệ
      newJob.postedBy = user;
      newJob.posted_by = userId;
      if (user.company_id) newJob.company_id = user.company_id;

      const savedJob = await this.jobRepository.save(newJob);

      // Xử lý Skills
      if (dto.skills && dto.skills.length > 0) {
        for (const skillName of dto.skills) {
          const cleanName = skillName.trim();
          let skill = await this.skillRepository.findOne({
            where: { skill_name: cleanName },
          });
          if (!skill) {
            skill = this.skillRepository.create({ skill_name: cleanName });
            skill = await this.skillRepository.save(skill);
          }
          await this.jobSkillRepository.save({
            job_id: savedJob.job_id,
            skill_id: skill.skill_id,
            is_required: true,
          });
        }
      }
      return savedJob;
    } catch (error) {
      console.error('Create Job Error:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  // --- 2. GET MY JOBS ---
  async getMyJobs(userId: number) {
    return await this.jobRepository.find({
      where: { posted_by: userId },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
      order: { created_at: 'DESC' },
    });
  }

  // --- 3. GET JOB DETAIL ---
  async getJobDetail(userId: number, jobId: number) {
    const job = await this.jobRepository.findOne({
      where: {
        job_id: jobId,
        posted_by: userId,
      },
      relations: ['company', 'jobSkills', 'jobSkills.skill'],
    });

    return job;
  }

  // --- 4. GET JOB APPLICATIONS ---
  async getJobApplications(userId: number, jobId: number) {
    const job = await this.jobRepository.findOne({
      where: { job_id: jobId, posted_by: userId },
    });

    if (!job) {
      throw new NotFoundException(
        'Job không tồn tại hoặc bạn không có quyền truy cập',
      );
    }

    const applications = await this.applicationRepository.find({
      where: { job_id: jobId },
      relations: ['user', 'cv'],
      order: { applied_at: 'DESC' },
    });

    return applications;
  }

  // --- 5. UPDATE APPLICATION STATUS ---
  async updateApplicationStatus(
    userId: number,
    applicationId: number,
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.applicationRepository.findOne({
      where: { application_id: applicationId },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException('Hồ sơ ứng tuyển không tồn tại');
    }

    if (application.job.posted_by !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa hồ sơ này');
    }

    application.status = dto.status;
    return await this.applicationRepository.save(application);
  }

  // --- 6. DASHBOARD STATS (Dữ liệu thật) ---
  async getRecruiterStats(userId: number) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    if (!user) throw new NotFoundException('User not found');

    // 1. Tổng số Job đã đăng
    const totalJobs = await this.jobRepository.count({
      where: { posted_by: userId },
    });

    // 2. Tổng số Hồ sơ ứng tuyển (Query qua bảng Job)
    const totalApplications = await this.applicationRepository
      .createQueryBuilder('app')
      .innerJoin('app.job', 'job')
      .where('job.posted_by = :userId', { userId })
      .getCount();

    // 3. Số Job đang Active (Chưa hết hạn deadline)
    const activeJobs = await this.jobRepository.count({
      where: {
        posted_by: userId,
        deadline: MoreThan(new Date()), // Hạn nộp phải lớn hơn thời gian hiện tại
      },
    });

    return {
      company: user.company ? user.company.name : 'Chưa cập nhật công ty',
      stats: {
        totalJobs,
        totalApplications,
        activeJobs,
      },
    };
  }

  // --- 7. CHART DATA (Biểu đồ 6 tháng gần nhất - MySQL) ---
  async getRecruiterChartData(userId: number) {
    // A. Chuẩn bị khung dữ liệu cho 6 tháng (Labels & Map)
    const labels: string[] = [];
    const dataMap = new Map<string, number>();
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      // Tạo ngày của tháng quá khứ
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

      // Key để map dữ liệu (Format: YYYY-MM) -> Khớp với format MySQL bên dưới
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      // Label hiển thị ra view (VD: Tháng 12)
      const label = `Tháng ${d.getMonth() + 1}`;

      labels.push(label);
      dataMap.set(key, 0); // Mặc định là 0
    }

    // B. Query dữ liệu thật từ DB
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Lấy ngày đầu tiên của 6 tháng trước

    const result = await this.applicationRepository
      .createQueryBuilder('app')
      .leftJoin('app.job', 'job')
      // MySQL: Format ngày tháng năm-tháng để group
      .select("DATE_FORMAT(app.applied_at, '%Y-%m')", 'month')
      .addSelect('COUNT(app.application_id)', 'count')
      .where('job.posted_by = :userId', { userId })
      .andWhere('app.applied_at >= :date', { date: sixMonthsAgo })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // C. Đổ dữ liệu từ DB vào Map
    // result trả về dạng: [{ month: '2025-12', count: '5' }, ...]
    result.forEach((item) => {
      // Ép kiểu item.month về string cho chắc chắn
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const monthKey = String(item.month);
      if (dataMap.has(monthKey)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        dataMap.set(monthKey, Number(item.count));
      }
    });

    // D. Trả về format ChartJS
    return {
      labels: labels,
      data: Array.from(dataMap.values()),
    };
  }
  // --- [MỚI] CẬP NHẬT THÔNG TIN CÔNG TY ---
  async updateCompanyProfile(userId: number, dto: UpdateCompanyDto) {
    // 1. Lấy thông tin User để biết company_id
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });

    if (!user || !user.company_id) {
      throw new NotFoundException('Bạn chưa liên kết với công ty nào');
    }

    // 2. Cập nhật thông tin Company
    await this.companyRepository.update(
      { company_id: user.company_id },
      {
        name: dto.name,
        description: dto.description,
        address: dto.address,
        website: dto.website,
        logo_url: dto.logo_url, // Nếu có gửi kèm
      },
    );

    // 3. Trả về thông tin mới nhất
    return await this.companyRepository.findOne({
      where: { company_id: user.company_id },
    });
  }

  // --- [MỚI] LẤY THÔNG TIN CÔNG TY CỦA TÔI ---
  async getMyCompanyProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['company'],
    });

    if (!user || !user.company) {
      return null; // Hoặc throw exception tùy logic
    }
    return user.company;
  }
}
