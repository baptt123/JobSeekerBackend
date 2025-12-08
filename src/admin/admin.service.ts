import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { CompanyEntity } from '../entity/company.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { AdminCreateCompanyDto } from '../admin-dto/admin-create-company.dto';

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
  ) {}

  // 1. Dashboard thống kê tổng quan
  async getDashboardStats() {
    const totalUsers = await this.userRepo.count();
    const totalJobs = await this.jobRepo.count();
    const totalCompanies = await this.companyRepo.count();
    const totalApplications = await this.appRepo.count();

    return {
      totalUsers,
      totalJobs,
      totalCompanies,
      totalApplications,
    };
  }

  // 2. Lấy danh sách Users (Phân trang)
  async getAllUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await this.userRepo.findAndCount({
      skip,
      take: limit,
      relations: ['role', 'company'], // Load thêm company để biết ai là Recruiter của cty nào
      order: { created_at: 'DESC' },
    });

    return {
      data: users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 3. Xóa User (Ban user)
  async deleteUser(userId: number) {
    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) throw new NotFoundException('User không tồn tại');

    // Xóa cứng (hoặc dùng softDelete nếu entity có @DeleteDateColumn)
    await this.userRepo.delete(userId);
    return { message: 'Đã xóa người dùng thành công' };
  }

  // 4. Tạo công ty mới
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

  // 5. Gán User làm Recruiter cho Công ty
  async assignRecruiterToCompany(userId: number, companyId: number) {
    const user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) throw new NotFoundException('User không tồn tại');

    const company = await this.companyRepo.findOneBy({ company_id: companyId });
    if (!company) throw new NotFoundException('Công ty không tồn tại');

    // Cập nhật thông tin
    user.company = company;
    user.company_id = companyId;
    user.role_id = 3; // Giả định ID 3 là RECRUITER (cần khớp với DB của bạn)

    return await this.userRepo.save(user);
  }
}
