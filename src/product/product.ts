import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DataTypeDeclaration } from '../declaring-data-type/interface-data';
@Entity('products')
export class Product implements DataTypeDeclaration {
  @Column('name')
  name: string;
  @PrimaryGeneratedColumn()
  id: number;
}
