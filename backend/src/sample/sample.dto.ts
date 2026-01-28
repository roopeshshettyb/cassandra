import { ApiProperty } from '@nestjs/swagger';

export class CreateSampleDto {
  @ApiProperty()
  readonly id?: number;
}

export class UpdateSampleDto {
  @ApiProperty({ required: false })
  readonly id?: number;
}
