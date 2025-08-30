import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { RoleEntity } from './role.entity';
import { CompanyEntity } from './company.entity';
import { UserCVEntity } from './user-cv.entity';
import { JobEntity } from './job.entity';
import { JobApplicationEntity } from './job-application.entity';
import { SavedJobEntity } from './save_job.entity';
import { MessageEntity } from './messages.entity';
import { NotificationEntity } from './notification.entity';
@Entity('Users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column()
  password_hash: string;

  @Column({ length: 200 })
  full_name: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 500, nullable: true })
  avatar_url: string;

  @Column()
  role_id: number;

  @ManyToOne(() => RoleEntity, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column({ nullable: true })
  company_id: number;

  @ManyToOne(() => CompanyEntity, (company) => company.users, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserCVEntity, (cv) => cv.user)
  cvs: UserCVEntity[];

  @OneToMany(() => JobEntity, (job) => job.postedBy)
  postedJobs: JobEntity[];

  @OneToMany(() => JobApplicationEntity, (app) => app.user)
  jobApplications: JobApplicationEntity[];

  @OneToMany(() => SavedJobEntity, (saved) => saved.user)
  savedJobs: SavedJobEntity[];

  @OneToMany(() => MessageEntity, (message) => message.sender)
  sentMessages: MessageEntity[];

  @OneToMany(() => MessageEntity, (message) => message.receiver)
  receivedMessages: MessageEntity[];

  @OneToMany(() => NotificationEntity, (notification) => notification.user)
  notifications: NotificationEntity[];
}
