import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { RoleEntity } from './role.entity';
import { CompanyEntity } from './company.entity';
import { UserCVEntity } from './user-cv.entity';
import { JobEntity } from './job.entity';
import { JobApplicationEntity } from './job-application.entity';
import { SavedJobEntity } from './save_job.entity';
import { MessageEntity } from './messages.entity';
import NotificationEntity from './notification.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true, length: 255 })
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  // Trong user.entity.ts
  @Column({ select: false }) // 👈 Thêm dòng này
  @ApiProperty({ writeOnly: true }) // Swagger chỉ hiện khi gửi lên, không hiện khi trả về
  password_hash: string;

  @Column({ length: 200 })
  @ApiProperty()
  full_name: string;

  @Column({ length: 20, nullable: true })
  @ApiProperty({ required: false })
  phone: string;

  @Column({ length: 100, nullable: true })
  @ApiProperty({ required: false })
  city: string;

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  avatar_url: string;

  @Column()
  role_id: number;

  @ManyToOne(() => RoleEntity, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  @ApiProperty({ type: () => RoleEntity }) // <--- FIX CIRCULAR
  role: RoleEntity;

  @Column({ nullable: true })
  company_id: number;

  @ManyToOne(() => CompanyEntity, (company) => company.users, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'company_id' })
  @ApiProperty({ type: () => CompanyEntity, required: false }) // <--- FIX CIRCULAR
  company: CompanyEntity;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserCVEntity, (cv) => cv.user)
  @ApiProperty({ type: () => UserCVEntity, isArray: true }) // <--- FIX CIRCULAR
  cvs: UserCVEntity[];

  @OneToMany(() => JobEntity, (job) => job.postedBy)
  @ApiProperty({ type: () => JobEntity, isArray: true }) // <--- FIX CIRCULAR
  postedJobs: JobEntity[];

  @OneToMany(() => JobApplicationEntity, (app) => app.user)
  @ApiProperty({ type: () => JobApplicationEntity, isArray: true }) // <--- FIX CIRCULAR
  jobApplications: JobApplicationEntity[];

  @OneToMany(() => SavedJobEntity, (saved) => saved.user)
  @ApiProperty({ type: () => SavedJobEntity, isArray: true }) // <--- FIX CIRCULAR
  savedJobs: SavedJobEntity[];

  @OneToMany(() => MessageEntity, (message) => message.sender)
  @ApiProperty({ type: () => MessageEntity, isArray: true }) // <--- FIX CIRCULAR
  sentMessages: MessageEntity[];

  @OneToMany(() => MessageEntity, (message) => message.receiver)
  @ApiProperty({ type: () => MessageEntity, isArray: true }) // <--- FIX CIRCULAR
  receivedMessages: MessageEntity[];

  @OneToMany(() => NotificationEntity, (notification) => notification.user)
  @ApiProperty({ type: () => NotificationEntity, isArray: true }) // <--- FIX CIRCULAR
  notifications: NotificationEntity[];
  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    required: false,
    description: 'Firebase Cloud Messaging Token',
  })
  fcm_token: string;
}
