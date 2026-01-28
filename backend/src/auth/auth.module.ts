import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtMiddleware } from './jwt.middleware';
import { AccountsModule } from '../accounts/accounts.module';
import { CommonModule } from '../common/common.module';
import { ConstantsService } from '../common/constants/constants.service';

@Module({
  imports: [
    PassportModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [CommonModule],
      useFactory: async (constantsService: ConstantsService) => {
        const privateConstants = constantsService.private;
        return {
          secret: privateConstants.JWT_SECRET,
          signOptions: { expiresIn: `${privateConstants.JWT_EXPIRY_DAYS}d` },
        };
      },
      inject: [ConstantsService],
    }),
    AccountsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtMiddleware],
  exports: [AuthService, JwtMiddleware],
})
export class AuthModule {}
