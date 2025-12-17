import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { JobEntity } from './job.entity';

@Entity('comments')
export class CommentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  jobId: number;

  // Quan hệ với Job
  @ManyToOne(() => JobEntity, (job) => job.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: JobEntity;

  // Quan hệ với User
  @ManyToOne(() => UserEntity, (user) => user.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' }) // <--- OK: Đặt tên cột trong bảng Comments là user_id
  user: UserEntity;
  @DeleteDateColumn()
  deleted_at: Date;
}