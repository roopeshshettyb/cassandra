import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsObject, IsNotEmpty } from 'class-validator';
import { AccountRole, AuthType } from './accounts.model';

export class CreateAccountDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly uuid?: string;

  @IsOptional()
  @IsObject()
  @ApiProperty({ required: false })
  readonly oauthMeta?: {
    [provider: string]: {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      expiresAt?: Date;
      [key: string]: any;
    };
  };

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly email?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly phone?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly profilePicUrl?: string;

  @IsOptional()
  @IsEnum(AccountRole)
  @ApiProperty({ required: false, enum: AccountRole })
  readonly role?: AccountRole;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly email?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly phone?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly profilePicUrl?: string;

  @IsOptional()
  @IsEnum(AccountRole)
  @ApiProperty({ required: false, enum: AccountRole })
  readonly role?: AccountRole;
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly defaultCurrency?: string;
}
