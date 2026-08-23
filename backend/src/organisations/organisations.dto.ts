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

/**
 * Creating a staff-side user. organisationId is optional here because who may set
 * it depends on the caller: an admin chooses, an owner has it forced to their own.
 * The service decides; the DTO only says what may arrive.
 */
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

  // Nullable, and null is a distinct intent from omitting the field. Note that
  // detaching only succeeds alongside a role change to admin: owners and staff
  // must belong to one, so clearing it on them is refused rather than leaving
  // somebody unscoped.
  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ nullable: true })
  readonly organisationId?: number | null;
}
