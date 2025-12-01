import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { UserEntity } from './user.entity';
import { CVKeywordEntity } from './cv-keyword.entity';

@Entity('user_cvs')
@Index('idx_fulltext_content', ['content'], { fulltext: true })
export class UserCVEntity {
  @PrimaryGeneratedColumn()
  cv_id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.cvs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ type: () => UserEntity }) // <--- FIX CIRCULAR
  user: UserEntity;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false })
  title: string;

  @Column({ length: 500, nullable: true })
  @ApiProperty({ required: false })
  file_url: string;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  content: string;

  @Column('boolean', { default: false })
  @ApiProperty()
  is_default: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => CVKeywordEntity, (keyword) => keyword.cv)
  @ApiProperty({ type: () => CVKeywordEntity, isArray: true }) // <--- FIX CIRCULAR
  keywords: CVKeywordEntity[];
}
