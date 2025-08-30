// ...các import cần thiết...
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  role_id: number;

  @Column({
    type: 'enum',
    enum: ['ADMIN', 'CANDIDATE', 'RECRUITER'],
    unique: true,
  })
  role_name: 'ADMIN' | 'CANDIDATE' | 'RECRUITER';

  @OneToMany(() => UserEntity, (user) => user.role_id)
  users: UserEntity[];
}
