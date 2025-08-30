import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { JobEntity } from './job.entity';

@Entity('Companies')
export class CompanyEntity {
  @PrimaryGeneratedColumn()
  company_id: number;

  @Column({ length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ length: 255, nullable: true })
  website: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 500, nullable: true })
  logo_url: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserEntity, (user) => user.company)
  users: UserEntity[];

  @OneToMany(() => JobEntity, (job) => job.company)
  jobs: JobEntity[];
}
