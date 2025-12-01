import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
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
  @ApiProperty({ enum: ['ADMIN', 'CANDIDATE', 'RECRUITER'] }) // Hiển thị enum dropdown trên Swagger
  role_name: 'ADMIN' | 'CANDIDATE' | 'RECRUITER';

  @OneToMany(() => UserEntity, (user) => user.role_id)
  @ApiProperty({ type: () => UserEntity, isArray: true }) // <--- FIX CIRCULAR
  users: UserEntity[];
}
