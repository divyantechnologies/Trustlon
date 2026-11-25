import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../users/wallet/wallet.module';
import { AdminCatalogController } from './catalog/catalog.controller';
import { AdminCatalogService } from './catalog/catalog.service';
import { AdminContentController } from './content/content.controller';
import { AdminContentService } from './content/content.service';
import { AdminCustomersController } from './customers/customers.controller';
import { AdminCustomersService } from './customers/customers.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AdminOrdersController } from './orders/orders.controller';
import { AdminOrdersService } from './orders/orders.service';
import { AdminProductsController } from './products/products.controller';
import { AdminProductsService } from './products/products.service';
import { AdminSettingsController } from './settings/settings.controller';
import { AdminStaffController } from './staff/staff.controller';
import { AdminStaffService } from './staff/staff.service';
import { AdminTrustController, ReportsController } from './trust/trust.controller';
import { AdminTrustService } from './trust/trust.service';
import { AdminVendorsController } from './vendors/vendors.controller';
import { AdminVendorsService } from './vendors/vendors.service';

/**
 * The admin panel API (spec section 5): every route needs a staff session that passed
 * two-factor sign-in, a permission from the role matrix, and writes the audit log.
 */
@Module({
  imports: [AuthModule, WalletModule],
  controllers: [
    DashboardController,
    AdminVendorsController,
    AdminCatalogController,
    AdminProductsController,
    AdminOrdersController,
    AdminCustomersController,
    AdminContentController,
    AdminTrustController,
    ReportsController,
    AdminSettingsController,
    AdminStaffController,
  ],
  providers: [
    DashboardService,
    AdminVendorsService,
    AdminCatalogService,
    AdminProductsService,
    AdminOrdersService,
    AdminCustomersService,
    AdminContentService,
    AdminTrustService,
    AdminStaffService,
  ],
})
export class AdminModule {}
