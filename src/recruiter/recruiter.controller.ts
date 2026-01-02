import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Render,
  Req,
  UseGuards,
  ValidationPipe,
  InternalServerErrorException, // Import thêm để throw lỗi nếu cần
} from '@nestjs/common';
import { Roles } from '../decorator/role.decorator';
import { RecruiterService } from './recruiter.service';
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { WebAuthGuard } from '../guard/web-auth.guard';
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';
import { CommentService } from '../comments/comments.service';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';

@Controller('recruiter')
@UseGuards(WebAuthGuard)
@Roles('RECRUITER', 'ADMIN')
export class RecruiterController {
  constructor(
    private readonly service: RecruiterService,
    private readonly commentService: CommentService,
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  @Get('dashboard')
  @Render('recruiter/dashboard')
  async getDashboard(@Req() req: any) {
    const userId = req.user.userId;
    const data = await this.service.getRecruiterStats(userId);
    const chartData = await this.service.getRecruiterChartData(userId);

    return {
      user: req.user,
      company: data.company,
      stats: data.stats,
      chartData: JSON.stringify(chartData),
      activePage: 'dashboard',
    };
  }

  // ==================================================================
  // KHU VỰC QUẢN LÝ VIỆC LÀM (JOBS)
  // ==================================================================

  @Get('jobs/create')
  @Render('recruiter/post-job')
  getPostJobPage(@Req() req: any) {
    return {
      user: req.user,
      activePage: 'post-job',
    };
  }

  @Get('jobs')
  @Render('recruiter/my-jobs')
  async getMyJobs(@Req() req: any) {
    try {
      const userId = req.user.userId;
      const jobs = await this.service.getMyJobs(userId);

      // [DEBUG LOG] Kiểm tra danh sách job lấy về
      // console.log(`[DEBUG] getMyJobs - User ${userId} has ${jobs.length} jobs`);

      const jobsWithSkills = jobs.map((job) => {
        // [SAFETY CHECK] Kiểm tra kỹ năng null
        const safeSkillNames =
          job.jobSkills && Array.isArray(job.jobSkills)
            ? job.jobSkills
              .filter((js) => {
                if (!js || !js.skill) {
                  console.error(
                    `[WARN] Job ID ${job.job_id} có JobSkill bị lỗi (null data)`,
                  );
                  return false;
                }
                return true;
              })
              .map((js) => js.skill.skill_name)
              .join(', ')
            : '';

        return {
          ...job,
          skillNames: safeSkillNames,
        };
      });

      return {
        jobs: jobsWithSkills,
        user: req.user,
        activePage: 'jobs',
      };
    } catch (error) {
      console.error('[ERROR] getMyJobs failed:', error);
      throw error;
    }
  }

  @Post('jobs')
  async createJob(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RecruiterCreateJobDto,
  ) {
    const userId = req.user.userId;
    console.log(`Recruiter ID ${userId} đang tạo job mới...`);

    const job = await this.service.createJob(userId, dto);

    await this.firebaseService.sendNotificationToTopic(
      'job_alerts',
      '🔥 Việc làm mới!',
      `${job.title} tại ${job.location}`,
      { jobId: job.job_id.toString(), type: 'NEW_JOB_POST' },
    );

    return job;
  }

// [SỬA LẠI HÀM NÀY ĐỂ XỬ LÝ DỮ LIỆU AN TOÀN TUYỆT ĐỐI]
  @Get('jobs/:id')
  @Render('recruiter/job-detail')
  async getJobDetail(@Req() req: any, @Param('id') id: string) {
    try {
      const userId = req.user.userId;
      const jobId = +id;

      const job = await this.service.getJobDetail(userId, jobId);
      if (!job) {
        throw new NotFoundException('Job không tìm thấy');
      }

      const applications = await this.service.getJobApplications(userId, jobId);

      // 1. Xử lý an toàn danh sách Kỹ năng (Skills)
      const safeSkillList =
        job.jobSkills && Array.isArray(job.jobSkills)
          ? job.jobSkills
            .filter((js) => js && js.skill)
            .map((js) => js.skill.skill_name)
          : [];

      // 2. Xử lý an toàn danh sách Ứng viên (Applications)
      // Tránh lỗi khi 'user' bị null (orphan data) gây crash View
      const safeApplications = applications.map((app) => ({
        ...app,
        user: app.user || {
          full_name: 'Người dùng không xác định',
          email: '',
          avatar_url: null,
        },
        cv: app.cv || null,
      }));

      return {
        job: {
          ...job,
          skillList: safeSkillList,
        },
        applications: safeApplications, // Dùng danh sách đã làm sạch
        user: req.user,
        activePage: 'jobs',
      };
    } catch (error) {
      console.error(`[ERROR] Xem chi tiết Job ID ${id} thất bại:`, error);
      throw error; // Để NestJS tự xử lý hiển thị trang lỗi 500 nếu cần
    }
  }

  // ==================================================================
  // CÁC CHỨC NĂNG KHÁC
  // ==================================================================

  @Get('jobs/:jobId/applications')
  async getJobApplications(@Req() req: any, @Param('jobId') jobId: string) {
    return this.service.getJobApplications(req.user.userId, +jobId);
  }

  @Patch('applications/:id/status')
  async updateApplicationStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: UpdateApplicationStatusDto,
  ) {
    return this.service.updateApplicationStatus(req.user.userId, +id, dto);
  }

  @Get('chat')
  @Render('recruiter/chat')
  getChatPage(@Req() req: any) {
    return {
      user: req.user,
      activePage: 'chat',
    };
  }

  @Get('company-profile')
  @Render('recruiter/company-profile')
  async getCompanyProfilePage(@Req() req: any) {
    const company = await this.service.getMyCompanyProfile(req.user.userId);
    return {
      user: req.user,
      company: company,
      activePage: 'profile',
    };
  }

  @Patch('company-profile')
  async updateCompanyProfile(
    @Req() req: any,
    @Body(new ValidationPipe()) dto: UpdateCompanyDto,
  ) {
    return await this.service.updateCompanyProfile(req.user.userId, dto);
  }

  @Get('comments')
  @Render('recruiter/comments')
  async getCommentsPage(@Req() req: any) {
    const comments = await this.commentService.getCommentsByRecruiter(
      req.user.userId,
    );
    return {
      user: req.user,
      comments: comments,
      activePage: 'comments',
    };
  }

  @Delete('comments/:id')
  async deleteComment(@Req() req: any, @Param('id') id: string) {
    await this.commentService.deleteComment(+id, req.user.userId, 'RECRUITER');
    return { message: 'Xoá thành công' };
  }
}