import { Global, Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuditService } from './audit.service';
import { PermissionsService } from './permissions.service';

/** Guard, permission matrix and audit log shared by every admin module. */
@Global()
@Module({
  providers: [AdminGuard, AuditService, PermissionsService],
  exports: [AdminGuard, AuditService, PermissionsService],
})
export class AdminCommonModule {}
