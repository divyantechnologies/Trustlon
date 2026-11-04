import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshCookie } from './refresh-cookie';
import { OtpService } from './services/otp.service';
import { SessionService } from './services/session.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, SessionService, RefreshCookie],
  exports: [SessionService],
})
export class AuthModule {}
