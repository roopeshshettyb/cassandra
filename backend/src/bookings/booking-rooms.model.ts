import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Booking } from './bookings.model';
import { Room } from '../rooms/rooms.model';

// Which physical room is held for which nights. Dates are stored here as well as
// on the booking so a room can be swapped mid-stay without rewriting the booking.
@Table({ tableName: 'booking_rooms' })
export class BookingRoom extends Model<BookingRoom> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Booking)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'booking_id',
  })
  bookingId: number;

  @ForeignKey(() => Room)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'room_id',
  })
  roomId: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: 'check_in',
  })
  checkIn: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: 'check_out',
  })
  checkOut: string;

  @BelongsTo(() => Booking, { foreignKey: 'bookingId', as: 'booking' })
  booking: Booking;

  @BelongsTo(() => Room, { foreignKey: 'roomId', as: 'room' })
  room: Room;
}
