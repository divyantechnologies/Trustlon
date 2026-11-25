import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/auth/optional-jwt-auth.guard';
import { CreateReviewDto, UpdateReviewDto } from './dto';
import { MAX_REVIEW_UPLOAD_BYTES, ReviewsService, UploadedFileData } from './reviews.service';

/** My reviews (spec 3.7). */
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Items waiting for a review, and the customer's own reviews. */
  @Get('me/reviews')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  mine(@CurrentUser() user: AuthUser) {
    return this.reviews.mine(user.id);
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto, @Req() req: Request) {
    const agent = req.headers['user-agent'];
    return this.reviews.create(user.id, dto, {
      ip: req.ip,
      userAgent: typeof agent === 'string' ? agent : undefined,
    });
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(user.id, id, dto);
  }

  /** Upload one photo or video (field name "file"); send the returned id with the review. */
  @Post('reviews/media')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_REVIEW_UPLOAD_BYTES, files: 1 } }),
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileData | undefined) {
    return this.reviews.uploadMedia(user.id, file);
  }

  /** Public for published reviews, so product pages can show customer photos. */
  @Get('reviews/media/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async media(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.reviews.media(user?.id ?? null, id);
    res.set({ 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=3600' });
    return new StreamableFile(file.content);
  }
}
