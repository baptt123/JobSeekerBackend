import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateSavedJobDto } from '../dto/create-saved-job.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { CreateJobDto } from '../dto/create-job.dto';
import { RolesGuard } from '../guard/role-auth.guard';
import { Roles } from '../decorator/role.decorator';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @Post()
  async create(@Body() dto: CreateSavedJobDto, @Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    dto.user_id = req.user.user_id; // tự động lấy user đăng nhập
    return this.jobService.create(dto);
  }
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @Get()
  async list(@Req() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.jobService.findByUser(req.user.user_id);
  }

  // @Delete(':job_id')
  // async remove(@Req() req, @Param('job_id') job_id: number) {
  //   return this.savedJobsService.remove(req.user.user_id, job_id);
  // }
  @Roles('RECRUITER')
  @UseGuards(RolesGuard)
  @Post()
  async createNewJob(@Body() createJobDto: CreateJobDto, @Req() req) {
    // posted_by lấy từ req.user.user_id khi xác thực JWT
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    createJobDto.posted_by = req.user.user_id;
    return await this.jobService.createNewJob(createJobDto);
  }
}
