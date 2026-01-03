import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
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
  @ApiProperty({ type: () => JobEntity }) // <--- THÊM
  job: JobEntity;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.jobApplications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ type: () => UserEntity }) // <--- THÊM
  user: UserEntity;

  @Column({ nullable: true })
  cv_id: number;

  @ManyToOne(() => UserCVEntity, (cv) => cv, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cv_id' })
  @ApiProperty({ type: () => UserCVEntity, required: false }) // <--- THÊM
  cv: UserCVEntity;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false }) // Thêm để hiện trong Swagger
  cover_letter: string;

  @Column({
    type: 'enum',
    enum: [
      'Applied',
      'Screening',
      'Interview',
      'Offer',
      'Accepted',
      'Rejected',
      'Cancelled', // [FIX] Thêm trạng thái Cancelled vào đây
    ],
    default: 'Applied',
  })
  @ApiProperty({
    enum: [
      'Applied',
      'Screening',
      'Interview',
      'Offer',
      'Accepted',
      'Rejected',
    ],
  })
  status:
    | 'Applied'
    | 'Screening'
    | 'Interview'
    | 'Offer'
    | 'Accepted'
    | 'Rejected'
    | 'Cancelled'; // [FIX] Thêm trạng thái Cancelled vào TypeScript Type

  @CreateDateColumn()
  applied_at: Date;
}
