import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { actorOf } from '../../../common/admin/audit.service';
import { AdminController, Can } from '../../../common/admin/decorators';
import { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { AdminCatalogService } from './catalog.service';
import {
  AttributeDto,
  CategoryAttributesDto,
  CategoryDto,
  HsnDto,
  HsnQuery,
  ReorderDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
} from './dto';

@AdminController('')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get('categories')
  @Can('catalog', 'view')
  categories() {
    return this.catalog.categories();
  }

  @Post('categories')
  @Can('catalog', 'create')
  create(@Body() dto: CategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.catalog.createCategory(dto, actorOf(user, req));
  }

  @Post('categories/reorder')
  @Can('catalog', 'edit')
  @HttpCode(HttpStatus.OK)
  reorder(@Body() dto: ReorderDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.catalog.reorder(dto, actorOf(user, req));
  }

  @Patch('categories/:id')
  @Can('catalog', 'edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalog.updateCategory(id, dto, actorOf(user, req));
  }

  @Delete('categories/:id')
  @Can('catalog', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.catalog.deleteCategory(id, actorOf(user, req));
  }

  @Get('categories/:id/attributes')
  @Can('catalog', 'view')
  categoryAttributes(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.categoryAttributes(id);
  }

  @Put('categories/:id/attributes')
  @Can('catalog', 'edit')
  setCategoryAttributes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoryAttributesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalog.setCategoryAttributes(id, dto, actorOf(user, req));
  }

  @Get('attributes')
  @Can('catalog', 'view')
  attributes() {
    return this.catalog.attributes();
  }

  @Post('attributes')
  @Can('catalog', 'create')
  createAttribute(@Body() dto: AttributeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.catalog.createAttribute(dto, actorOf(user, req));
  }

  @Patch('attributes/:id')
  @Can('catalog', 'edit')
  updateAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalog.updateAttribute(id, dto, actorOf(user, req));
  }

  @Get('hsn')
  @Can('catalog', 'view')
  hsn(@Query() query: HsnQuery) {
    return this.catalog.hsn(query);
  }

  @Post('hsn')
  @Can('catalog', 'create')
  addHsn(@Body() dto: HsnDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.catalog.addHsn(dto, actorOf(user, req));
  }

  @Delete('hsn/:id')
  @Can('catalog', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeHsn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.catalog.removeHsn(id, actorOf(user, req));
  }
}
