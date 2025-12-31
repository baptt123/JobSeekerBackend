import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('logs')
export class LogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string; // Vd: UPLOAD_CV, GENERATE_CV, DELETE_CV

  @Column('text')
  details: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.user_id)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}