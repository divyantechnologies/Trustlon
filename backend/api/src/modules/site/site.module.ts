import { Global, Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { SiteSettingsService } from './site-settings.service';

/** Global so any module can read the current settings (business rules, tax, features…). */
@Global()
@Module({
  controllers: [SiteController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteModule {}
