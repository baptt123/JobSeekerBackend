import {
  Body,
  Controller,
  Delete,
  Get, HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JobService } from './job.service';
import { Roles } from '../decorator/role.decorator';
import { RolesGuard } from '../guard/role-auth.guard';
import { SearchJobDto } from '../dto/search-job.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { FilterJobDto } from '../dto/filter-job.dto';
import { SavedJobDto } from '../dto/save-job.dto';
import { JobDto } from '../dto/job.dto';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  @Get('recommended')
  async getRecommendedJobs(@Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId; // từ request.user (JWT payload)
    console.log('>>> userId:', userId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.jobService.findJobsByUserCV(userId);
  }

  @Get('search-jobs')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async searchJobs(@Query() dto: SearchJobDto) {
    return this.jobService.searchJobs(dto);
  }

  @Get('suggest')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async suggestJobs(@Query('q') q: string) {
    return this.jobService.suggestJobs(q);
  }

  @Get('filter')
  async filterJobs(@Query() dto: FilterJobDto) {
    return this.jobService.filterJobs(dto);
  }

  @Get('detail/:title')
  @HttpCode(200)
  async getJobDetail(@Param('title') title: string) {
    return this.jobService.getJobDetail(title);
  }

  @Post('create-save-job')
  async saveJob(@Body() createSavedJobDto: SavedJobDto) {
    return await this.jobService.saveJob(createSavedJobDto);
  }

  @Get('get-saved-jobs')
  async getSavedJobs(@Req() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
    return await this.jobService.getSavedJobs(user.userId);
  }

  @Delete('remove-job/:jobId')
  async removeSavedJob(@Req() user: any, @Param('jobId') jobId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return await this.jobService.removeSavedJob(user.userId, jobId);
  }

  @Get('get-all-jobs')
  async getAllJobs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{
    data: JobDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // Ép kiểu đảm bảo giá trị hợp lệ
    const currentPage = Number(page) > 0 ? Number(page) : 1;
    const pageLimit = Number(limit) > 0 ? Number(limit) : 10;

    return await this.jobService.displayJob(currentPage, pageLimit);
  }
}
