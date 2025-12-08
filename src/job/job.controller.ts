import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { JobService } from './job.service';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';
import { SearchJobDto } from '../dto/search-job.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { FilterJobDto } from '../dto/filter-job.dto';
import { SaveJobDto } from '../dto/save-job.dto';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { JwtService } from '@nestjs/jwt';

@Controller('job')
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly jwtService: JwtService, // Inject JwtService để giải mã token thủ công cho các route public
  ) {}

  // --- HELPER: Lấy userId từ header (nếu có) cho các route Public ---
  private getUserIdFromHeader(authHeader?: string): number | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const decoded = this.jwtService.decode(token);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
      return decoded?.sub || decoded?.user_id || null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return null;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @Get('recommended')
  async getRecommendedJobs(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    console.log('>>> userId:', userId);
    return this.jobService.findJobsByUserCV(userId);
  }

  @Get('search-jobs')
  async searchJobs(@Query() dto: SearchJobDto) {
    return this.jobService.searchJobs(dto);
  }

  @Get('suggest')
  async suggestJobs(@Query('q') q: string) {
    return this.jobService.suggestJobs(q);
  }

  @Get('filter')
  @HttpCode(200)
  async filterJobs(@Query() dto: FilterJobDto) {
    return this.jobService.filterJobs(dto);
  }

  /**
   * Xem chi tiết Job
   * - Thực tế: User chưa đăng nhập vẫn xem được.
   * - Nếu đã đăng nhập: Cần biết đã Save/Apply chưa.
   */
  @Get('detail/:title')
  @HttpCode(200)
  async getJobDetail(
    @Param('title') title: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = this.getUserIdFromHeader(authHeader);
    // userId có thể là number hoặc null
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.jobService.findJobDetail(title, userId);
  }

  /**
   * Lấy danh sách Job trang chủ
   * - Thực tế: Cần trả về `isSaved` để hiển thị nút trái tim ngay trên list.
   */
  @Get('get-all-jobs')
  async getAllJobs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = this.getUserIdFromHeader(authHeader);
    const currentPage = Number(page) > 0 ? Number(page) : 1;
    const pageLimit = Number(limit) > 0 ? Number(limit) : 10;

    return await this.jobService.displayJob(currentPage, pageLimit, userId);
  }

  /*
   * Lưu Job yêu thích
   * - Yêu cầu bắt buộc phải đăng nhập
   */
  @Post('create-save-job')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OrAuthGuard) // Guard xác thực
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  saveJob(@Req() req: any, @Body() saveJobDto: SaveJobDto) {
    // ✅ Lấy userId từ token thật
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.jobService.saveJob(req.user.userId, saveJobDto.job_id);
  }

  @Get('get-my-saved-jobs')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  getMySavedJobs(@Req() req: any) {
    // ✅ Lấy userId từ token thật
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.jobService.getMySavedJobs(req.user.userId);
  }

  @Delete('delete-job/:jobId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsaveJob(@Req() req: any, @Param('jobId', ParseIntPipe) jobId: number) {
    // ✅ Lấy userId từ token thật
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
    return this.jobService.unsaveJob(req.user.userId, jobId);
  }
  // [THÊM MỚI] API lấy chi tiết công ty và jobs
  @Get('company/:id/jobs')
  @HttpCode(200)
  async getCompanyJobs(@Param('id', ParseIntPipe) id: number) {
    const result = await this.jobService.getCompanyWithJobs(id);
    if (!result) {
      return {
        message: 'Không tìm thấy dữ liệu công ty hoặc công ty chưa có job nào.',
        data: null,
      };
    }
    return { data: result };
  }
}
