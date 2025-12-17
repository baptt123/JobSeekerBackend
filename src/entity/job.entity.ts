import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from './user.entity';
import { JobSkillEntity } from './job-skill.entity';
import { JobApplicationEntity } from './job-application.entity';
import { SavedJobEntity } from './save_job.entity';
import { CompanyEntity } from './company.entity';
import { CommentEntity } from './comment.entity';

@Entity('jobs')
export class JobEntity {
  @PrimaryGeneratedColumn()
  job_id: number;

  // --- COMPANY & POSTED BY (Giữ nguyên fix lỗi 500) ---
  @Column({ nullable: true })
  company_id: number;

  @ManyToOne(() => CompanyEntity, (company) => company.jobs, {
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'company_id' })
  @ApiProperty({ type: () => CompanyEntity })
  company: CompanyEntity;

  @Column()
  posted_by: number;

  @ManyToOne(() => UserEntity, (user) => user.postedJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'posted_by' })
  @ApiProperty({ type: () => UserEntity })
  postedBy: UserEntity;

  // --- THÔNG TIN JOB ---
  @Column({ length: 255 })
  @ApiProperty()
  title: string;

  @Column('text')
  @ApiProperty()
  description: string;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  requirements: string;

  // ❌ ĐÃ XÓA cột skills simple-array ở đây.
  // Dữ liệu sẽ đi qua bảng jobSkills bên dưới.

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  @ApiProperty({ required: false })
  salary_min: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  @ApiProperty({ required: false })
  salary_max: number;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false })
  location: string;

  @Column({
    type: 'enum',
    enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'],
    nullable: true,
  })
  @ApiProperty({
    enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'],
    required: false,
  })
  job_type: string;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ required: false })
  deadline: Date;

  @CreateDateColumn()
  created_at: Date;

  // --- QUAN HỆ VỚI BẢNG JOB_SKILLS (QUAN TRỌNG) ---
  @OneToMany(() => JobSkillEntity, (jobSkill) => jobSkill.job)
  @ApiProperty({ type: () => JobSkillEntity, isArray: true })
  jobSkills: JobSkillEntity[];

  @OneToMany(() => JobApplicationEntity, (application) => application.job)
  @ApiProperty({ type: () => JobApplicationEntity, isArray: true })
  applications: JobApplicationEntity[];

  @OneToMany(() => SavedJobEntity, (savedJob) => savedJob.job)
  @ApiProperty({ type: () => SavedJobEntity, isArray: true })
  savedJobs: SavedJobEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.job)
  comments: CommentEntity[];
  // ... trong class JobEntity
  @DeleteDateColumn()
  deleted_at: Date; // <--- Thêm dòng này
}