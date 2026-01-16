import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { UserEntity } from './user.entity';
import { JobEntity } from './job.entity';

@Entity('companies')
export class CompanyEntity {
  @PrimaryGeneratedColumn()
  company_id: number;

  @Column({ length: 255 })
  @ApiProperty()
  name: string;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  description: string;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false })
  website: string;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false })
  address: string;

  @Column({ length: 500, nullable: true })
  @ApiProperty({ required: false })
  logo_url: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserEntity, (user) => user.company)
  @ApiProperty({ type: () => UserEntity, isArray: true }) // <--- THÊM
  users: UserEntity[];

  @OneToMany(() => JobEntity, (job) => job.company)
  @ApiProperty({ type: () => JobEntity, isArray: true }) // <--- THÊM
  jobs: JobEntity[];
  // [THÊM MỚI] Cột này bắt buộc để dùng softDelete
  @DeleteDateColumn()
  deleted_at: Date;
}
