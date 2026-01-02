import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// ENTITIES
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { CompanyEntity } from '../entity/company.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { CommentEntity } from '../entity/comment.entity'; // Thêm để thống kê Dashboard

// DTOs
import { AdminCreateCompanyDto } from '../admin-dto/admin-create-company.dto';

const ITEMS_PER_PAGE = 10; // Cấu hình số lượng mỗi trang

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly appRepo: Repository<JobApplicationEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepo: Repository<CommentEntity>,
  ) {}

  // ==========================================
  // 1. DASHBOARD & STATS
  // ==========================================
  async getDashboardStats() {
    const totalUsers = await this.userRepo.count();
    const totalJobs = await this.jobRepo.count();
    const totalCompanies = await this.companyRepo.count();
    // Thống kê bình luận (interactions)
    const totalComments = await this.commentRepo.count();

    return {
      totalUsers,
      totalJobs,
      totalCompanies,
      totalComments,
    };
  }

  async getChartData() {
    // A. Chuẩn bị Labels (6 tháng gần nhất)
    const labels: string[] = [];
    const monthsMap = new Map<string, string>(); // Key: '2023-10', Value: 'Oct'

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      labels.push(monthLabel);
      monthsMap.set(key, monthLabel);
    }

    // B. Query Users
    const rawUsers = await this.userRepo
      .createQueryBuilder('u')
      .select("DATE_FORMAT(u.created_at, '%Y-%m')", 'month')
      .addSelect('COUNT(u.user_id)', 'count')
      .where('u.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // C. Query Jobs
    const rawJobs = await this.jobRepo
      .createQueryBuilder('j')
      .select("DATE_FORMAT(j.created_at, '%Y-%m')", 'month')
      .addSelect('COUNT(j.job_id)', 'count')
      .where('j.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // D. Map Data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCountMap: any = rawUsers.reduce((acc: any, cur: any) => {
      acc[cur.month] = Number(cur.count);
      return acc;
    }, {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobCountMap: any = rawJobs.reduce((acc: any, cur: any) => {
      acc[cur.month] = Number(cur.count);
      return acc;
    }, {});

    const userData: number[] = [];
    const jobData: number[] = [];

    monthsMap.forEach((label, key) => {
      userData.push(userCountMap[key] || 0);
      jobData.push(jobCountMap[key] || 0);
    });

    return {
      labels,
      users: userData,
      jobs: jobData,
    };
  }

  // ==========================================
  // 2. USER MANAGEMENT (Với Pagination chuẩn)
  // ==========================================
  async getAllUsers(page: number) {
    const limit = ITEMS_PER_PAGE;
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepo.findAndCount({
      skip,
      take: limit,
      withDeleted: true, // Lấy cả user đã bị soft delete
      relations: ['role', 'company'],
      order: { created_at: 'DESC' },
    });

    const totalPages = Math.ceil(total / limit);

    // Trả về cấu trúc chuẩn cho View Pagination
    return {
      data: users,
      total,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
    };
  }

  async softDeleteUser(userId: number) {
    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) throw new NotFoundException('User không tồn tại');

    // Soft Delete (TypeORM tự update cột deleted_at)
    return await this.userRepo.softDelete(userId);
  }

  async restoreUser(userId: number) {
    // Restore (TypeORM tự set deleted_at = null)
    return await this.userRepo.restore(userId);
  }

  async changeUserRole(userId: number, roleId: number) {
    await this.userRepo.update(userId, { role_id: roleId });
    return { message: 'Cập nhật phân quyền thành công' };
  }

  // ==========================================
  // 3. COMPANY MANAGEMENT (Với Pagination chuẩn)
  // ==========================================
  async getAllCompanies(page: number) {
    const limit = ITEMS_PER_PAGE;
    const skip = (page - 1) * limit;

    const [companies, total] = await this.companyRepo.findAndCount({
      skip,
      take: limit,
      relations: ['jobs'], // Đếm số job
      order: { created_at: 'DESC' },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: companies,
      total,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
    };
  }

  async createCompany(dto: AdminCreateCompanyDto) {
    const newComp = this.companyRepo.create({
      name: dto.name,
      description: dto.description,
      address: dto.address,
      website: dto.website,
      logo_url: dto.logo_url,
    });
    return await this.companyRepo.save(newComp);
  }

  async deleteCompany(id: number) {
    const company = await this.companyRepo.findOneBy({ company_id: id });
    if (!company) {
      throw new NotFoundException('Công ty không tồn tại');
    }
    // Dùng Soft Delete cho an toàn (nếu entity có @DeleteDateColumn)
    // Nếu muốn xóa cứng thì dùng .delete(id)
    return await this.companyRepo.softDelete(id);
  }

  // ==========================================
  // 4. HELPER FUNCTION
  // ==========================================
  async assignRecruiterToCompany(userId: number, companyId: number) {
    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) throw new NotFoundException('User không tồn tại');

    const company = await this.companyRepo.findOneBy({ company_id: companyId });
    if (!company) throw new NotFoundException('Công ty không tồn tại');

    user.company = company;
    user.company_id = companyId;
    user.role_id = 3; // 3 = RECRUITER

    return await this.userRepo.save(user);
  }
}
