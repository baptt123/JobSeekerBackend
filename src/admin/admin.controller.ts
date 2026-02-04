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
@UseGuards(WebAuthGuard, RolesGuard)
@Roles(1)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly jobService: JobService,
    private readonly commentService: CommentService,
  ) {}


  @Get('dashboard')
  @Render('admin/dashboard')
  async getDashboard(@Req() req: any) {
    const stats = await this.adminService.getDashboardStats();
    const chartData = await this.adminService.getChartData();
    return { user: req.user, stats, chartData: JSON.stringify(chartData), activePage: 'dashboard' };
  }

  @Get('users')
  @Render('admin/users')
  async getUsersPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;
    const result = await this.adminService.getAllUsers(pageNum);
    return { user: req.user, users: result.data, pagination: { ...result, currentPage: result.currentPage, hasNext: result.hasNext, hasPrev: result.hasPrev, nextPage: result.nextPage, prevPage: result.prevPage, pages: result.pages }, activePage: 'users' };
  }
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) { await this.adminService.softDeleteUser(+id); return { message: 'Đã khóa tài khoản thành công' }; }
  @Post('users/:id/restore')
  async restoreUser(@Param('id') id: string) { await this.adminService.restoreUser(+id); return { message: 'Đã mở khóa tài khoản' }; }
  @Patch('users/:id/role')
  async changeUserRole(@Param('id') id: string, @Body('roleId') roleId: number) { await this.adminService.changeUserRole(+id, roleId); return { message: 'Cập nhật quyền thành công' }; }

  @Get('companies')
  @Render('admin/companies')
  async getCompaniesPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;
    const result = await this.adminService.getAllCompanies(pageNum);
    return { user: req.user, companies: result.data, pagination: { ...result, currentPage: result.currentPage, hasNext: result.hasNext, hasPrev: result.hasPrev, nextPage: result.nextPage, prevPage: result.prevPage, pages: result.pages }, activePage: 'companies' };
  }
  @Delete('companies/:id')
  async deleteCompany(@Param('id') id: string) { await this.adminService.deleteCompany(+id); return { message: 'Đã xóa công ty thành công' }; }



  // --- [MỚI] CHI TIẾT JOB ---
  @Get('jobs/:id')
  @Render('admin/job-detail')
  async getJobDetail(@Req() req: any, @Param('id') id: string) {
    const job = await this.adminService.getJobDetail(+id);
    return {
      user: req.user,
      job: {
        ...job,
        skillList: job.jobSkills?.map((js) => js.skill.skill_name) || [],
      },
      activePage: 'jobs',
    };
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    await this.jobService.deleteJob(+id);
    return { message: 'Đã gỡ bài đăng thành công' };
  }
// 4. JOBS
  @Get('jobs')
  @Render('admin/jobs')
  async getJobsPage(
    @Req() req: any,
    @Query('page') page: string,
    @Query('companyId') companyId: string // [NEW] Lấy companyId từ query
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const compIdNum = companyId ? parseInt(companyId) : undefined;

    // Truyền companyId vào service
    const result = await this.adminService.getAllJobsForAdmin(pageNum, compIdNum);

    return {
      user: req.user,
      jobs: result.data,
      pagination: {
        total: result.total,
        currentPage: result.page,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
        nextPage: result.page + 1,
        prevPage: result.page - 1,
        pages: Array.from({ length: result.totalPages }, (_, i) => i + 1),
        // Giữ lại companyId khi phân trang để không bị mất filter
        companyId: compIdNum
      },
      activePage: 'jobs',
    };
  }
  // 5. COMMENTS
  @Get('comments')
  @Render('admin/comments')
  async getCommentsPage(@Req() req: any, @Query('page') page: string) {
    const pageNum = page ? parseInt(page) : 1;
    const result = await this.commentService.getAllComments(pageNum);
    return {
      user: req.user,
      comments: result.data,
      pagination: {
        total: result.total,
        currentPage: result.page,
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
  async deleteComment(@Param('id') id: string) { await this.commentService.deleteCommentByAdmin(+id); return { message: 'Đã xóa bình luận' }; }
}