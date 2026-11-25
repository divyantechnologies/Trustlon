import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminRefreshCookie } from './admin-refresh-cookie';

@Module({
  imports: [AuthModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminRefreshCookie],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
