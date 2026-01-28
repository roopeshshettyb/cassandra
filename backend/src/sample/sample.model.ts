import { Table, Model, Column, DataType } from 'sequelize-typescript';

@Table({ tableName: 'samples' })
export class Sample extends Model<Sample> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  id: number;
}
