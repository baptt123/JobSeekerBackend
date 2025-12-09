import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Render,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { WebAuthGuard } from '../guard/web-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { AdminCreateCompanyDto } from '../admin-dto/admin-create-company.dto';

@Controller('admin')
@UseGuards(WebAuthGuard) // <--- 1. Bảo vệ bằng Cookie Guard (cho trình duyệt)
@Roles('ADMIN') // <--- 2. Chỉ cho phép Role ADMIN
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // ==========================================
  // 1. DASHBOARD
  // ==========================================
  @Get('dashboard')
  @Render('admin/dashboard')
  async getDashboard() {
    // Lấy số liệu thống kê tổng quan
    const stats = await this.service.getDashboardStats();

    // Lấy dữ liệu biểu đồ (User tăng trưởng, Job mới...)
    const chartData = await this.service.getChartData();

    return {
      stats,
      // Quan trọng: Stringify dữ liệu biểu đồ để truyền xuống Script dưới View
      chartData: JSON.stringify(chartData),
    };
  }

  // ==========================================
  // 2. USER MANAGEMENT (Quản lý người dùng)
  // ==========================================
  @Get('users')
  @Render('admin/users')
  async getAllUsers(@Query('page') page = 1, @Query('limit') limit = 10) {
    const result = await this.service.getAllUsers(Number(page), Number(limit));
    return {
      users: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  // Soft Delete User (Ban user - Không xóa hẳn khỏi DB)
  @Delete('users/:id')
  async softDeleteUser(@Param('id') id: string) {
    return this.service.softDeleteUser(+id);
  }

  // Restore User (Mở khóa tài khoản đã Ban)
  @Patch('users/:id/restore')
  async restoreUser(@Param('id') id: string) {
    return this.service.restoreUser(+id);
  }

  // Đổi Role (Chuyển Candidate <-> Recruiter <-> Admin)
  @Patch('users/:id/role')
  async changeRole(@Param('id') id: string, @Body('roleId') roleId: number) {
    return this.service.changeUserRole(+id, roleId);
  }

  // ==========================================
  // 3. COMPANY MANAGEMENT (Quản lý công ty)
  // ==========================================
  @Get('companies')
  @Render('admin/companies')
  async getAllCompanies(@Query('page') page = 1, @Query('limit') limit = 10) {
    const result = await this.service.getAllCompanies(
      Number(page),
      Number(limit),
    );
    return {
      companies: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  // Tạo công ty mới
  @Post('company')
  async createCompany(@Body() dto: AdminCreateCompanyDto) {
    return this.service.createCompany(dto);
  }

  // Xóa công ty (Nếu bạn đã implement trong Service, có thể bỏ comment)
  // [CẬP NHẬT] API Xóa Công ty
  @Delete('companies/:id')
  async deleteCompany(@Param('id', ParseIntPipe) id: number) {
    // Gọi service để xử lý xóa
    return this.service.deleteCompany(id);
  }

  // Gán User làm Recruiter cho Công ty
  @Post('assign-recruiter')
  async assignRecruiter(
    @Body('userId') userId: number,
    @Body('companyId') companyId: number,
  ) {
    return this.service.assignRecruiterToCompany(userId, companyId);
  }
}
