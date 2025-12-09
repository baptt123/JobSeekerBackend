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
  async getChartData() {
    // A. Chuẩn bị danh sách 6 tháng gần nhất (Labels)
    const labels: string[] = [];
    const monthsMap = new Map<string, string>(); // Key: '2023-10', Value: 'Oct'

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      // Format label hiển thị: 'Jan', 'Feb'...
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      // Format key để so sánh với DB (MySQL format %Y-%m): '2023-10'
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      labels.push(monthLabel);
      monthsMap.set(key, monthLabel); // Lưu map để tí nữa mapping dữ liệu
    }

    // B. Query thống kê User mới theo tháng
    const rawUsers = await this.userRepo
      .createQueryBuilder('u')
      .select("DATE_FORMAT(u.created_at, '%Y-%m')", 'month')
      .addSelect('COUNT(u.user_id)', 'count')
      .where('u.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // C. Query thống kê Job mới theo tháng
    const rawJobs = await this.jobRepo
      .createQueryBuilder('j')
      .select("DATE_FORMAT(j.created_at, '%Y-%m')", 'month')
      .addSelect('COUNT(j.job_id)', 'count')
      .where('j.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // D. Mapping dữ liệu từ DB vào danh sách tháng đã chuẩn bị (điền 0 nếu thiếu)
    // Tạo mảng map tạm để dễ truy xuất: {'2023-10': 10, '2023-11': 5...}
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const userCountMap = rawUsers.reduce((acc, cur) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      acc[cur.month] = Number(cur.count);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return acc;
    }, {});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const jobCountMap = rawJobs.reduce((acc, cur) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      acc[cur.month] = Number(cur.count);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return acc;
    }, {});

    // Tạo mảng data final khớp thứ tự với labels
    const userData: number[] = [];
    const jobData: number[] = [];

    // Duyệt qua map keys của 6 tháng đã tạo ở bước A
    monthsMap.forEach((label, key) => {
      // key dạng '2023-10'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      userData.push(userCountMap[key] || 0);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      jobData.push(jobCountMap[key] || 0);
    });

    return {
      labels: labels, // ['Aug', 'Sep', 'Oct'...]
      users: userData,
      jobs: jobData,
    };
  }
  // [THÊM MỚI] Lấy danh sách Company (Phân trang)
  // 1. Lấy danh sách Users (Hỗ trợ phân trang + Lấy cả user đã bị xóa mềm)
  async getAllUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await this.userRepo.findAndCount({
      skip,
      take: limit,
      withDeleted: true, // <--- QUAN TRỌNG: Lấy cả user đã bị soft delete
      relations: ['role', 'company'],
      order: { created_at: 'DESC' },
    });

    return {
      data: users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 2. Soft Delete User (Ban)
  async softDeleteUser(userId: number) {
    await this.userRepo.softDelete(userId); // TypeORM tự động update cột deleted_at
    return { message: 'User has been banned' };
  }

  // 3. Restore User (Unban)
  async restoreUser(userId: number) {
    await this.userRepo.restore(userId); // TypeORM tự động set deleted_at = null
    return { message: 'User has been restored' };
  }

  // 4. Đổi Role (Switch Candidate <-> Recruiter)
  async changeUserRole(userId: number, roleId: number) {
    await this.userRepo.update(userId, { role_id: roleId });
    return { message: 'Role updated successfully' };
  }

  // 5. Lấy danh sách Companies (Fix lỗi trang Companies)
  async getAllCompanies(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [companies, total] = await this.companyRepo.findAndCount({
      skip,
      take: limit,
      relations: ['jobs'],
      order: { created_at: 'DESC' },
    });
    return {
      data: companies,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
  // [THÊM MỚI] Xóa Công ty
  async deleteCompany(id: number) {
    // 1. Kiểm tra xem công ty có tồn tại không
    const company = await this.companyRepo.findOneBy({ company_id: id });

    if (!company) {
      throw new NotFoundException('Công ty không tồn tại hoặc đã bị xóa');
    }

    // 2. Thực hiện xóa
    // Lưu ý: Do trong JobEntity bạn đã set { onDelete: 'CASCADE' }
    // nên khi xóa Company, tất cả Jobs của Company đó cũng sẽ bị xóa theo.
    await this.companyRepo.delete(id);

    return { message: 'Đã xóa công ty và các công việc liên quan thành công' };
  }
}
