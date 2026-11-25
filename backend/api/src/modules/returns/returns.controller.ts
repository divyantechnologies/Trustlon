import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateReturnDto, ReturnListQueryDto } from './dto';
import { MAX_PHOTO_BYTES, ReturnsService, UploadedImage } from './returns.service';

/** Customer returns (spec 3.3). Every route is scoped to the signed-in customer. */
@Controller('returns')
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: AuthUser, @Query() query: ReturnListQueryDto) {
    return this.returns.list(user.id, query);
  }

  /** What can be returned from a delivered shipment, and the refund options. */
  @Get('eligibility/:subOrderId')
  @Header('Cache-Control', 'private, no-store')
  eligibility(
    @CurrentUser() user: AuthUser,
    @Param('subOrderId', ParseUUIDPipe) subOrderId: string,
  ) {
    return this.returns.eligibility(user.id, subOrderId);
  }

  /** Upload one photo (field name "photo"); send the returned id with the return request. */
  @Post('photos')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  uploadPhoto(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedImage | undefined) {
    return this.returns.uploadPhoto(user.id, file);
  }

  @Get('photos/:photoId')
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const photo = await this.returns.photo(user.id, photoId);
    res.set({ 'Content-Type': photo.contentType, 'Cache-Control': 'private, max-age=3600' });
    return new StreamableFile(photo.content);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReturnDto) {
    return this.returns.create(user.id, dto);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.detail(user.id, id);
  }

  /** Allowed until the courier picks the items up. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.cancel(user.id, id);
  }
}
