import { Injectable } from '@nestjs/common';
import { ConstantsService } from './common/constants/constants.service';

@Injectable()
export class AppService {
  constructor(private constantsService: ConstantsService) {}

  getHello(): string {
    return `${this.constantsService.public.APP_NAME} API is running!`;
  }
}
