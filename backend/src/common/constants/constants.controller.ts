import { Controller, Get } from '@nestjs/common';
import { ConstantsService } from './constants.service';

@Controller('constants')
export class ConstantsController {
  constructor(private constantsService: ConstantsService) {}

  @Get('public')
  getPublicConstants() {
    return this.constantsService.public;
  }
}

