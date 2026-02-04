import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// ENTITIES
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { CompanyEntity } from '../entity/company.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { CommentEntity } from '../entity/comment.entity';



const ITEMS_PER_PAGE = 10;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepo: Repository<CommentEntity>,
  ) {}

  async getDashboardStats() {
    const totalUsers = await this.userRepo.count();
    const totalJobs = await this.jobRepo.count();
    const totalCompanies = await this.companyRepo.count();
    const totalComments = await this.commentRepo.count();
    return { totalUsers, totalJobs, totalCompanies, totalComments };
  }

  async getChartData() {
    const labels: string[] = [];
    const monthsMap = new Map<string, string>();
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
    const rawUsers = await this.userRepo.createQueryBuilder('u').select("DATE_FORMAT(u.created_at, '%Y-%m')", 'month').addSelect('COUNT(u.user_id)', 'count').where('u.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)').groupBy('month').orderBy('month', 'ASC').getRawMany();
    const rawJobs = await this.jobRepo.createQueryBuilder('j').select("DATE_FORMAT(j.created_at, '%Y-%m')", 'month').addSelect('COUNT(j.job_id)', 'count').where('j.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)').groupBy('month').orderBy('month', 'ASC').getRawMany();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCountMap: any = rawUsers.reduce((acc: any, cur: any) => { acc[cur.month] = Number(cur.count); return acc; }, {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobCountMap: any = rawJobs.reduce((acc: any, cur: any) => { acc[cur.month] = Number(cur.count); return acc; }, {});
    const userData: number[] = [];
    const jobData: number[] = [];
    monthsMap.forEach((label, key) => { userData.push(userCountMap[key] || 0); jobData.push(jobCountMap[key] || 0); });
    return { labels, users: userData, jobs: jobData };
  }

  async getAllUsers(page: number) {
    const limit = ITEMS_PER_PAGE;
    const skip = (page - 1) * limit;
    const [users, total] = await this.userRepo.findAndCount({ skip, take: limit, withDeleted: true, relations: ['role', 'company'], order: { created_at: 'DESC' } });
    const totalPages = Math.ceil(total / limit);
    return { data: users, total, currentPage: page, totalPages, hasNext: page < totalPages, hasPrev: page > 1, nextPage: page + 1, prevPage: page - 1, pages: Array.from({ length: totalPages }, (_, i) => i + 1) };
  }
  async softDeleteUser(userId: number) { const user = await this.userRepo.findOneBy({ user_id: userId }); if (!user) throw new NotFoundException('User không tồn tại'); return await this.userRepo.softDelete(userId); }
  async restoreUser(userId: number) { return await this.userRepo.restore(userId); }
  async changeUserRole(userId: number, roleId: number) { await this.userRepo.update(userId, { role_id: roleId }); return { message: 'Cập nhật phân quyền thành công' }; }

  async getAllCompanies(page: number) {
    const limit = ITEMS_PER_PAGE;
    const skip = (page - 1) * limit;
    const [companies, total] = await this.companyRepo.findAndCount({ skip, take: limit, relations: ['jobs'], order: { created_at: 'DESC' } });
    const totalPages = Math.ceil(total / limit);
    return { data: companies, total, currentPage: page, totalPages, hasNext: page < totalPages, hasPrev: page > 1, nextPage: page + 1, prevPage: page - 1, pages: Array.from({ length: totalPages }, (_, i) => i + 1) };
  }
  async deleteCompany(id: number) { const company = await this.companyRepo.findOneBy({ company_id: id }); if (!company) { throw new NotFoundException('Công ty không tồn tại'); } return await this.companyRepo.softDelete(id); }

  // --- [MỚI] LẤY CHI TIẾT JOB CHO ADMIN ---
  async getJobDetail(id: number) {
    const job = await this.jobRepo.findOne({
      where: { job_id: id },
      relations: ['company', 'postedBy', 'jobSkills', 'jobSkills.skill'],
    });

    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }

    return job;
  }
  // [UPDATED] Hỗ trợ lọc theo companyId
  async getAllJobsForAdmin(page: number, companyId?: number) {
    const skip = (page - 1) * ITEMS_PER_PAGE;

    // Tạo query builder hoặc find options
    const whereCondition: any = {};
    if (companyId) {
      whereCondition.company = { company_id: companyId };
    }

    const [jobs, total] = await this.jobRepo.findAndCount({
      where: whereCondition, // Thêm điều kiện lọc
      relations: ['company', 'postedBy'],
      order: { created_at: 'DESC' },
      skip: skip,
      take: ITEMS_PER_PAGE,
      withDeleted: false,
    });

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return {
      data: jobs,
      total: total,
      page: page,
      totalPages: totalPages,
    };
  }
}