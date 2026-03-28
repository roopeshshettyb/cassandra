import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';
import { Account } from '../accounts/accounts.model';
import { Booking } from '../bookings/bookings.model';
import { Chat } from '../chat/chat.model';

export enum RequestType {
  ROOM_SERVICE = 'room_service',
  HOUSE_KEEPING = 'house_keeping',
  LAUNDRY = 'laundry',
  AIRPORT_TRANSFER = 'airport_transfer',
}

export enum RequestUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum RequestStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export interface RequestNote {
  text: string;
  addedAt?: string;
  accountId?: number;
}

@Table({ tableName: 'requests' })
export class Request extends Model<Request> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Hotel)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'hotel_id',
  })
  hotelId: number;

  @ForeignKey(() => Account)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'guest_id',
  })
  guestId: number;

  @ForeignKey(() => Booking)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'booking_id',
  })
  bookingId: number;

  @Column({
    type: DataType.ENUM(...Object.values(RequestType)),
    allowNull: false,
    field: 'request_type',
  })
  requestType: RequestType;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'user_notes',
  })
  userNotes: RequestNote[];

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'staff_notes',
  })
  staffNotes: RequestNote[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  data: Record<string, unknown>;

  @Column({
    type: DataType.ENUM(...Object.values(RequestUrgency)),
    allowNull: false,
  })
  urgency: RequestUrgency;

  @Column({
    type: DataType.ENUM(...Object.values(RequestStatus)),
    allowNull: false,
    defaultValue: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ForeignKey(() => Chat)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'chat_id',
  })
  chatId: number | null;

  @BelongsTo(() => Hotel, { foreignKey: 'hotelId', as: 'hotel' })
  hotel: Hotel;

  @BelongsTo(() => Account, { foreignKey: 'guestId', targetKey: 'id', as: 'guest' })
  guest: Account;

  @BelongsTo(() => Booking, { foreignKey: 'bookingId', as: 'booking' })
  booking: Booking;

  @BelongsTo(() => Chat, { foreignKey: 'chatId', as: 'chat' })
  chat: Chat;
}
