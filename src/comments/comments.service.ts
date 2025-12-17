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
import { UserEntity } from '../entity/user.entity'; // Vẫn cần import để ép kiểu
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

  // 1. Tạo comment (Nhận userId thay vì object User)
  async create(
    userId: number,
    createCommentDto: CreateCommentDto,
  ): Promise<CommentEntity> {
    // 1. Validate đầu vào cơ bản
    if (!userId) {
      throw new BadRequestException('User ID không hợp lệ.');
    }

    try {
      // 2. Tạo đối tượng Comment
      const newComment = this.commentRepository.create({
        content: createCommentDto.content,
        jobId: createCommentDto.jobId,

        // --- SỬA LẠI CHỖ NÀY ---
        // Dùng thuộc tính 'id' của UserEntity.
        // TypeORM sẽ tự động ánh xạ nó vào cột 'user_id' trong DB nhờ @JoinColumn.
        user: { user_id: userId } as UserEntity,
      });

      // 3. Lưu xuống Database
      return await this.commentRepository.save(newComment);
    } catch (error) {
      // 4. Ghi log lỗi chi tiết ra server để debug
      this.logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Lỗi khi tạo comment (Job: ${createCommentDto.jobId}, User: ${userId}) - Mess: ${error.message}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.stack,
      );

      // 5. Xử lý các loại lỗi cụ thể (nếu cần)
      // Ví dụ: Lỗi khóa ngoại (Foreign Key) - User hoặc Job không tồn tại
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.code === 'ER_NO_REFERENCED_ROW_2' ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        error.message.includes('foreign key constraint fails')
      ) {
        throw new BadRequestException(
          'Công việc hoặc Người dùng không tồn tại.',
        );
      }

      // 6. Ném ra lỗi chung 500 cho Client
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi đăng bình luận. Vui lòng thử lại sau.',
      );
    }
  }
  // 2. Lấy danh sách comment theo Job (Giữ nguyên)
  async findByJobId(jobId: number): Promise<CommentEntity[]> {
    try {
      return await this.commentRepository.find({
        where: { jobId },
        select: ['id', 'content', 'createdAt'],
        relations: ['user'], // Load thêm thông tin user nếu cần (tùy chọn)
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get comments for Job ID "${jobId}".`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.stack,
      );
      throw new InternalServerErrorException('Lỗi khi tải bình luận.');
    }
  }


  // --- CHO RECRUITER: Lấy comment thuộc các job của họ ---
  async getCommentsByRecruiter(recruiterId: number) {
    return await this.commentRepository.find({
      where: {
        job: { posted_by: recruiterId }, // Query xuyên qua relation Job
      },
      relations: ['user', 'job'],
      order: { createdAt: 'DESC' },
    });
  }

  // --- XÓA COMMENT (Dùng chung) ---
  // Recruiter chỉ xóa được comment trong bài của mình
  async deleteComment(
    commentId: number,
    userId: number,
    role: 'ADMIN' | 'RECRUITER',
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['job'],
    });

    if (!comment) throw new NotFoundException('Comment not found');

    if (role === 'RECRUITER') {
      // Check quyền sở hữu Job
      if (comment.job.posted_by !== userId) {
        throw new ForbiddenException('Bạn không có quyền xóa comment này');
      }
    }

    // Nếu là Admin thì xóa thoải mái
    return await this.commentRepository.remove(comment);
  }
  // [SỬA LẠI HÀM NÀY]
  async getAllComments(page: number) {
    const skip = (page - 1) * this.ITEMS_PER_PAGE;

    const [comments, total] = await this.commentRepository.findAndCount({
      relations: ['user', 'job', 'job.postedBy', 'job.company'],
      order: { createdAt: 'DESC' },
      skip: skip,
      take: this.ITEMS_PER_PAGE,
    });

    const totalPages = Math.ceil(total / this.ITEMS_PER_PAGE);

    return {
      data: comments,
      total: total,
      page: page,
      totalPages: totalPages
    };
  }

  async deleteCommentByAdmin(id: number) {
    return await this.commentRepository.softDelete(id);
  }
}
