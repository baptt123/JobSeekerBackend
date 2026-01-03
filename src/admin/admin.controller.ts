import {
  Controller,
  Get,
  Delete,
  Post,
  Render,
  Req,
  UseGuards,
  Param,
  Query,
  Body,
  Patch,
} from '@nestjs/common';
import { WebAuthGuard } from '../guard/web-auth.guard';
import { Roles } from '../decorator/role-admin-recruiter.decorator';

import { AdminService } from './admin.service';
import { JobService } from '../job/job.service';
import { CommentService } from '../comments/comments.service';
import { RolesGuard } from '../guard/role-auth.guard.admin.recruiter';

@Controller('admin')
@UseGuards(WebAuthGuard, RolesGuard) // Chạy WebAuthGuard trước để lấy user, rồi mới chạy RolesGuard@Roles('ADMIN')
@Roles(1)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly jobService: JobService,
    private readonly commentService: CommentService,
  ) {}

  // 1. DASHBOARD
  @Get('dashboard')
  @Render('admin/dashboard')
  async getDashboard(@Req() req: any) {
    const stats = await this.adminService.getDashboardStats();
    const chartData = await this.adminService.getChartData();

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      stats,
      chartData: JSON.stringify(chartData),
      activePage: 'dashboard',
    };
  }

  // 2. USERS
  @Get('users')
  @Render('admin/users')
  async getUsersPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;

    // [FIX LỖI 1] Chỉ truyền 1 tham số (pageNum), bỏ số 10 đi
    const result = await this.adminService.getAllUsers(pageNum);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      users: result.data,
      pagination: {
        ...result,
        // [FIX LỖI 2] Dùng 'currentPage' thay vì 'page'
        currentPage: result.currentPage,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        nextPage: result.nextPage,
        prevPage: result.prevPage,
        pages: result.pages,
      },
      activePage: 'users',
    };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    await this.adminService.softDeleteUser(+id);
    return { message: 'Đã khóa tài khoản thành công' };
  }

  @Post('users/:id/restore')
  async restoreUser(@Param('id') id: string) {
    await this.adminService.restoreUser(+id);
    return { message: 'Đã mở khóa tài khoản' };
  }

// [SỬA LẠI HÀM NÀY] Thay vì @Post('users/assign-role')
  @Patch('users/:id/role')
  async changeUserRole(
    @Param('id') id: string,
    @Body('roleId') roleId: number // Nhận roleId từ body
  ) {
    // Gọi service
    await this.adminService.changeUserRole(+id, roleId);
    return { message: 'Cập nhật quyền thành công' };
  }

  // 3. COMPANIES
  @Get('companies')
  @Render('admin/companies')
  async getCompaniesPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;

    // [FIX LỖI TƯƠNG TỰ] Chỉ truyền 1 tham số
    const result = await this.adminService.getAllCompanies(pageNum);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      companies: result.data,
      pagination: {
        ...result,
        currentPage: result.currentPage, // Dùng currentPage
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        nextPage: result.nextPage,
        prevPage: result.prevPage,
        pages: result.pages,
      },
      activePage: 'companies',
    };
  }

  @Delete('companies/:id')
  async deleteCompany(@Param('id') id: string) {
    await this.adminService.deleteCompany(+id);
    return { message: 'Đã xóa công ty thành công' };
  }

  // 4. JOBS (Giữ nguyên vì JobService của bạn trả về 'page')
  @Get('jobs')
  @Render('admin/jobs')
  async getJobsPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;
    const result = await this.jobService.getAllJobsForAdmin(pageNum);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      jobs: result.data,
      pagination: {
        total: result.total,
        currentPage: result.page, // JobService trả về 'page'
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
        nextPage: result.page + 1,
        prevPage: result.page - 1,
        pages: Array.from({ length: result.totalPages }, (_, i) => i + 1),
      },
      activePage: 'jobs',
    };
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    await this.jobService.deleteJob(+id);
    return { message: 'Đã gỡ bài đăng thành công' };
  }

  // 5. COMMENTS
  @Get('comments')
  @Render('admin/comments')
  async getCommentsPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;
    const result = await this.commentService.getAllComments(pageNum);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      comments: result.data,
      pagination: {
        total: result.total,
        currentPage: result.page, // CommentService trả về 'page'
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
        nextPage: result.page + 1,
        prevPage: result.page - 1,
        pages: Array.from({ length: result.totalPages }, (_, i) => i + 1),
      },
      activePage: 'comments',
    };
  }

  @Delete('comments/:id')
  async deleteComment(@Param('id') id: string) {
    await this.commentService.deleteCommentByAdmin(+id);
    return { message: 'Đã xóa bình luận' };
  }
}
