import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserCVEntity } from './user-cv.entity';
import { KeywordEntity } from './keyword.entity';

@Entity('CV_Keywords')
export class CVKeywordEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserCVEntity, (cv) => cv.keywords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cv_id' })
  cv: UserCVEntity;

  @ManyToOne(() => KeywordEntity, (keyword) => keyword.cvKeywords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'keyword_id' })
  keyword: KeywordEntity;
}
