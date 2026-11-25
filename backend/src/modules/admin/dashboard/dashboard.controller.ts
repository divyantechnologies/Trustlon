import { Get, Query } from '@nestjs/common';
import { AdminController, Can } from '../../../middlewares/admin/decorators';
import { DateRangeQuery } from '../shared';
import { DashboardService } from './dashboard.service';

@AdminController('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @Can('dashboard', 'view')
  summary(@Query() query: DateRangeQuery) {
    return this.dashboard.summary(query);
  }
}
