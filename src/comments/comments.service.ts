import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CommentEntity } from '../entity/comment.entity';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  ITEMS_PER_PAGE = 10;
  constructor(
    @InjectRepository(CommentEntity)
    private commentRepository: Repository<CommentEntity>,
  ) {}



  async create(userId: number, createCommentDto: CreateCommentDto): Promise<CommentEntity> {
    if (!userId) {
      throw new BadRequestException('User ID không hợp lệ.');
    }
    try {
      const newComment = this.commentRepository.create({
        content: createCommentDto.content,
        jobId: createCommentDto.jobId,
        user: { user_id: userId } as UserEntity,
      });
      return await this.commentRepository.save(newComment);
    } catch (error) {
      this.logger.error(`Lỗi tạo comment: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Lỗi khi đăng bình luận.');
    }
  }

  async findByJobId(jobId: number): Promise<CommentEntity[]> {
    return await this.commentRepository.find({
      where: { jobId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getCommentsByRecruiter(recruiterId: number) {
    return await this.commentRepository.find({
      where: {
        job: { posted_by: recruiterId },
      },
      relations: ['user', 'job'],
      order: { createdAt: 'DESC' },
    });
  }

  // --- [CHỈNH SỬA QUAN TRỌNG] XÓA COMMENT (SOFT DELETE) ---
  async deleteComment(
    commentId: number,
    userId: number,
    role: 'ADMIN' | 'RECRUITER',
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['job'],
    });

    if (!comment) throw new NotFoundException('Không tìm thấy comment');

    if (role === 'RECRUITER') {
      // Check quyền sở hữu Job
      if (comment.job.posted_by !== userId) {
        throw new ForbiddenException('Bạn không có quyền xóa comment này');
      }
    }

    // [THAY ĐỔI] Dùng softDelete thay vì remove
    // softDelete cập nhật cột deleted_at thay vì xóa row khỏi DB
    return await this.commentRepository.softDelete(commentId);
  }

  // [CHỈNH SỬA] Hàm xóa của Admin cũng đảm bảo là soft delete
  async deleteCommentByAdmin(id: number) {
    return await this.commentRepository.softDelete(id);
  }

  async getAllComments(page: number) {
    const skip = (page - 1) * this.ITEMS_PER_PAGE;
    const [comments, total] = await this.commentRepository.findAndCount({
      relations: ['user', 'job', 'job.postedBy', 'job.company'],
      order: { createdAt: 'DESC' },
      skip: skip,
      take: this.ITEMS_PER_PAGE,
    });
    const totalPages = Math.ceil(total / this.ITEMS_PER_PAGE);
    return { data: comments, total, page, totalPages };
  }
}