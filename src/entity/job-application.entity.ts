import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { JobEntity } from './job.entity';
import { UserEntity } from './user.entity';
import { UserCVEntity } from './user-cv.entity';

@Entity('job_applications')
export class JobApplicationEntity {
  @PrimaryGeneratedColumn()
  application_id: number;

  @Column()
  job_id: number;

  @ManyToOne(() => JobEntity, (job) => job.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  @ApiProperty({ type: () => JobEntity })
  job: JobEntity;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.jobApplications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ type: () => UserEntity })
  user: UserEntity;

  @Column({ nullable: true })
  cv_id: number;

  @ManyToOne(() => UserCVEntity, (cv) => cv, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cv_id' })
  @ApiProperty({ type: () => UserCVEntity, required: false })
  cv: UserCVEntity;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  cover_letter: string;

  // Cột lưu kết quả phân tích AI
  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  ai_match_analysis: string;

  // [UPDATED] Chỉ giữ lại các trạng thái thực tế sử dụng
  @Column({
    type: 'enum',
    enum: [
      'Applied',  // Chờ duyệt (Mặc định)
      'Accepted', // Đã chấp nhận
      'Rejected', // Đã từ chối
    ],
    default: 'Applied',
  })
  @ApiProperty({
    enum: ['Applied', 'Accepted', 'Rejected'],
  })
  status: 'Applied' | 'Accepted' | 'Rejected';

  @CreateDateColumn()
  applied_at: Date;
}