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
} from '@nestjs/common';
import { Roles } from '../decorator/role-admin-recruiter.decorator';
import { RecruiterService } from './recruiter.service';
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { WebAuthGuard } from '../guard/web-auth.guard';
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';
import { CommentService } from '../comments/comments.service';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';
import { RolesGuard } from '../guard/role-auth.guard.admin.recruiter';
import { NotificationEntity } from '../entity/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('recruiter')
@UseGuards(WebAuthGuard, RolesGuard)
@Roles(1, 3)
export class RecruiterController {
  constructor(
    private readonly service: RecruiterService,
    private readonly commentService: CommentService,
    private readonly firebaseService: FirebaseModuleService,
    @InjectRepository(NotificationEntity)
    private readonly notiRepo: Repository<NotificationEntity>
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

  // --- QUẢN LÝ VIỆC LÀM ---

  @Get('jobs/create')
  @Render('recruiter/post-job')
  getPostJobPage(@Req() req: any) {
    return {
      user: req.user,
      activePage: 'post-job',
    };
  }

  @Post('jobs/generate-ai')
  async generateJobAI(@Body('prompt') prompt: string) {
    if (!prompt) return { success: false, message: 'Vui lòng nhập mô tả' };
    try {
      const data = await this.service.generateJobContentWithAI(prompt);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('jobs')
  @Render('recruiter/my-jobs')
  async getMyJobs(@Req() req: any) {
    const userId = req.user.userId;
    const jobs = await this.service.getMyJobs(userId);

    const jobsWithSkills = jobs.map((job) => {
      const safeSkillNames =
        job.jobSkills && Array.isArray(job.jobSkills)
          ? job.jobSkills
            .filter((js) => js && js.skill)
            .map((js) => js.skill.skill_name)
            .join(', ')
          : '';

      return { ...job, skillNames: safeSkillNames };
    });

    return {
      jobs: jobsWithSkills,
      user: req.user,
      activePage: 'jobs',
    };
  }

  @Post('jobs')
  async createJob(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RecruiterCreateJobDto,
  ) {
    const userId = req.user.userId;
    return await this.service.createJob(userId, dto);
  }

  @Get('jobs/:id')
  @Render('recruiter/job-detail')
  async getJobDetail(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    const jobId = +id;

    const job = await this.service.getJobDetail(userId, jobId);
    if (!job) {
      throw new NotFoundException('Job không tìm thấy');
    }

    const applications = await this.service.getJobApplications(userId, jobId);

    const safeSkillList =
      job.jobSkills && Array.isArray(job.jobSkills)
        ? job.jobSkills.filter((js) => js && js.skill).map((js) => js.skill.skill_name)
        : [];

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
      job: { ...job, skillList: safeSkillList },
      applications: safeApplications,
      user: req.user,
      activePage: 'jobs',
    };
  }

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

  // --- CÁC CHỨC NĂNG KHÁC (ĐÃ XÓA CHAT) ---

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
  @Get('notifications')
  @Render('recruiter/notifications')
  async viewNotifications(@Req() req: any) {
    const notifications = await this.notiRepo.find({
      where: { user: { user_id: req.user.userId } },
      order: { created_at: 'DESC' },
      take: 20
    });

    // Format ngày giờ Việt Nam
    const formattedNotis = notifications.map(n => ({
      ...n,
      timeDisplay: new Date(n.created_at).toLocaleString('vi-VN')
    }));

    return {
      notifications: formattedNotis,
      user: req.user,
      activeNoti: true // Active menu sidebar
    };
  }
}