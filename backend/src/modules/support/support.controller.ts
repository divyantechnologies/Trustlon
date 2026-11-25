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
import { AuthUser } from '../../middlewares/auth/auth-user';
import { CurrentUser } from '../../middlewares/auth/decorators';
import { JwtAuthGuard } from '../../middlewares/auth/jwt-auth.guard';
import { CreateTicketDto, TicketListQueryDto, TicketMessageDto } from './dto';
import { SupportService, TICKET_CATEGORY_LABELS, UploadedTicketFile } from './support.service';

/** Customer support tickets (spec 3.10). Agents reply from the Operations panel (6.2). */
@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: AuthUser, @Query() query: TicketListQueryDto) {
    return this.support.list(user.id, query);
  }

  /** Categories for the new-request form. */
  @Get('categories')
  categories() {
    return {
      items: Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  @Post('attachments')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedTicketFile | undefined) {
    return this.support.upload(user.id, file);
  }

  @Get('attachments/:id')
  async attachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.support.attachment(user.id, id);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${file.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(file.content);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.support.create(user.id, dto);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.detail(user.id, id);
  }

  @Post(':id/messages')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketMessageDto,
  ) {
    return this.support.reply(user.id, id, dto);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.resolve(user.id, id);
  }
}
