import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrganisationStatus } from './organisations.model';
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

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'ops@tajgroup.com' })
  readonly contactEmail?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '+91-22-6665-3366' })
  readonly contactPhone?: string;

  @IsOptional()
  @IsEnum(OrganisationStatus)
  @ApiPropertyOptional({ enum: OrganisationStatus })
  readonly status?: OrganisationStatus;
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

  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional()
  readonly contactEmail?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly contactPhone?: string;

  @IsOptional()
  @IsEnum(OrganisationStatus)
  @ApiPropertyOptional({ enum: OrganisationStatus })
  readonly status?: OrganisationStatus;
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

  // Nullable so an admin can detach a user from an organisation, which is a
  // distinct intent from leaving the field out.
  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ nullable: true })
  readonly organisationId?: number | null;
}
