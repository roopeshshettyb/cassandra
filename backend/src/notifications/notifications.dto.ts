import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNotEmpty, IsBoolean, IsNumber } from 'class-validator';
import { NotificationType } from './notifications.model';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty()
  readonly accountId: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  readonly title: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  readonly message: string;

  @IsOptional()
  @IsEnum(NotificationType)
  @ApiProperty({ required: false, enum: NotificationType, default: NotificationType.SYSTEM })
  readonly type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: false })
  readonly read?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly link?: string;
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export class RegisterDeviceDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Native FCM device token (from expo-notifications getDevicePushTokenAsync).' })
  readonly token: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  @ApiProperty({ required: false, enum: DevicePlatform, description: 'Reported platform — currently informational only; FCM routes to the right transport via the token.' })
  readonly platform?: DevicePlatform;
}

export class UpdateNotificationDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly message?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  @ApiProperty({ required: false, enum: NotificationType })
  readonly type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  readonly read?: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly link?: string;
}
