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
import { UserEntity } from './user.entity';
import { CVKeywordEntity } from './cv-keyword.entity';
@Entity('User_CVs')
@Index('idx_fulltext_content', ['content'], { fulltext: true })
export class UserCVEntity {
  @PrimaryGeneratedColumn()
  cv_id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.cvs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ length: 255, nullable: true })
  title: string;

  @Column({ length: 500, nullable: true })
  file_url: string;

  @Column('text', { nullable: true })
  content: string;

  @Column('boolean', { default: false })
  is_default: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => CVKeywordEntity, (keyword) => keyword.cv)
  keywords: CVKeywordEntity[];
}
