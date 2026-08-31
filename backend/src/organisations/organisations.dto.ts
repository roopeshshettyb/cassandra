import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AccountRole } from '../common/constants/constants.service';

export class CreateOrganisationDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Taj Group' })
  readonly name: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly description?: string;
}

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional()
  readonly name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly description?: string;
}

// organisationId is optional because the service decides it: an admin chooses,
// an owner has their own forced.
export class CreateOrganisationUserDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty()
  readonly email: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly name?: string;

  @IsEnum(AccountRole)
  @ApiProperty({ enum: AccountRole })
  readonly role: AccountRole;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  readonly organisationId?: number;
}

export class UpdateOrganisationUserDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly name?: string;

  @IsOptional()
  @IsEnum(AccountRole)
  @ApiPropertyOptional({ enum: AccountRole })
  readonly role?: AccountRole;

  // null detaches, which only succeeds alongside a role change to admin.
  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ nullable: true })
  readonly organisationId?: number | null;
}
