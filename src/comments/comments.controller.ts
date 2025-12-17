import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CommentService } from './comments.service';
import { Roles } from '../decorator/role.decorator';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  // khớp với Flutter: _dio.dio.get('/comments/job/$jobId');
  @Get('job/:jobId')
  async getCommentsByJob(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.commentService.findByJobId(jobId);
  }

  // khớp với Flutter: _dio.dio.post('/comments', data: {...});
  @UseGuards(OrAuthGuard) // Bắt buộc phải có Token hợp lệ
  @Post()
  @Roles('ADMIN', 'CANDIDATE', 'RECRUITER')
  async createComment(
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
    return this.commentService.create(req.user.userId, createCommentDto);
  }
}
