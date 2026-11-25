import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TicketAuthor, TicketCategory, TicketStatus } from '@prisma/client';
import { randomInt, randomUUID } from 'crypto';
import { Page, toPage } from '../../utils/http/pagination';
import { detectFileType, FileStorage } from '../../utils/storage/file-storage';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketDto, TicketListQueryDto, TicketMessageDto } from './dto';

export const TICKET_CREATED = 'support.ticket-created';
export const TICKET_CUSTOMER_REPLIED = 'support.customer-replied';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_DAILY_UPLOADS = 30;
/** Resolved tickets close for replies after this many days; the customer then opens a new one. */
export const REOPEN_WINDOW_DAYS = 7;
const MAX_OPEN_TICKETS = 10;

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER: 'An order',
  DELIVERY: 'Delivery or tracking',
  RETURN_REFUND: 'Return or refund',
  PAYMENT: 'Payment',
  PRODUCT: 'A product',
  ACCOUNT: 'My account',
  OTHER: 'Something else',
};

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_CUSTOMER,
];

export interface UploadedTicketFile {
  buffer: Buffer;
  size: number;
  originalname?: string;
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  categoryLabel: string;
  status: TicketStatus;
  order: { id: string; orderNumber: string } | null;
  lastMessageAt: Date;
  createdAt: Date;
  lastMessage: { authorType: TicketAuthor; preview: string } | null;
}

export interface TicketDetail extends TicketSummary {
  canReply: boolean;
  canClose: boolean;
  resolvedAt: Date | null;
  closedAt: Date | null;
  messages: Array<{
    id: string;
    authorType: TicketAuthor;
    authorName: string;
    body: string;
    createdAt: Date;
    attachments: Array<{ id: string; fileName: string; contentType: string; sizeBytes: number }>;
  }>;
}

const summaryInclude = {
  order: { select: { id: true, orderNumber: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { authorType: true, body: true } },
} satisfies Prisma.SupportTicketInclude;

type SummaryRow = Prisma.SupportTicketGetPayload<{ include: typeof summaryInclude }>;

function toSummary(row: SummaryRow): TicketSummary {
  const last = row.messages[0];
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    subject: row.subject,
    category: row.category,
    categoryLabel: TICKET_CATEGORY_LABELS[row.category],
    status: row.status,
    order: row.order ? { id: row.order.id, orderNumber: row.order.orderNumber } : null,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    lastMessage: last ? { authorType: last.authorType, preview: last.body.slice(0, 140) } : null,
  };
}

function ticketNumber(now: Date): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ST${yy}${mm}${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
}

function safeFileName(name: string | undefined, extension: string): string {
  const base = (name ?? 'file')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w .-]+/g, '')
    .trim()
    .slice(0, 100);
  return `${base || 'file'}.${extension}`;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly events: EventEmitter2,
  ) {}

  async list(userId: string, query: TicketListQueryDto): Promise<Page<TicketSummary>> {
    await this.closeStale(userId);
    const where: Prisma.SupportTicketWhereInput = {
      userId,
      ...(query.status === 'open' ? { status: { in: OPEN_STATUSES } } : {}),
      ...(query.status === 'resolved'
        ? { status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: summaryInclude,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return toPage(rows.map(toSummary), total, query.page, query.pageSize);
  }

  async detail(userId: string, id: string): Promise<TicketDetail> {
    await this.closeStale(userId);
    const row = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        ...summaryInclude,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: {
              select: { id: true, fileName: true, contentType: true, sizeBytes: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    const last = row.messages[row.messages.length - 1];
    return {
      ...toSummary({
        ...row,
        messages: last ? [{ authorType: last.authorType, body: last.body }] : [],
      }),
      canReply: row.status !== TicketStatus.CLOSED,
      canClose: OPEN_STATUSES.includes(row.status),
      resolvedAt: row.resolvedAt,
      closedAt: row.closedAt,
      messages: row.messages.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        authorName: message.authorName,
        body: message.body,
        createdAt: message.createdAt,
        attachments: message.attachments,
      })),
    };
  }

  async create(userId: string, dto: CreateTicketDto): Promise<TicketDetail> {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, userId },
        select: { id: true },
      });
      if (!order)
        throw new BadRequestException({ message: 'Choose one of your orders', field: 'orderId' });
    }
    const open = await this.prisma.supportTicket.count({
      where: { userId, status: { in: OPEN_STATUSES } },
    });
    if (open >= MAX_OPEN_TICKETS) {
      throw new ConflictException(
        'You already have several open requests. Reply on one of them and we will help you there.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true },
    });
    const now = new Date();
    const id = await this.prisma.$transaction(async (tx) => {
      let ticketId: string | null = null;
      for (let attempt = 0; attempt < 5 && !ticketId; attempt++) {
        const number = ticketNumber(now);
        if (
          await tx.supportTicket.findUnique({
            where: { ticketNumber: number },
            select: { id: true },
          })
        )
          continue;
        const ticket = await tx.supportTicket.create({
          data: {
            ticketNumber: number,
            userId,
            category: dto.category,
            subject: dto.subject,
            orderId: dto.orderId ?? null,
            lastMessageAt: now,
          },
          select: { id: true },
        });
        ticketId = ticket.id;
      }
      if (!ticketId) throw new ConflictException('Please try again.');

      const message = await tx.ticketMessage.create({
        data: {
          ticketId,
          authorType: TicketAuthor.CUSTOMER,
          authorName: user.fullName,
          body: dto.description,
          createdAt: now,
        },
        select: { id: true },
      });
      await this.attach(tx, userId, ticketId, message.id, dto.attachmentIds);
      await tx.ticketMessage.create({
        data: {
          ticketId,
          authorType: TicketAuthor.SYSTEM,
          authorName: 'Trustlon Support',
          body: 'Thanks for writing to us. Our support team will reply here, and we will let you know when they do.',
          createdAt: new Date(now.getTime() + 1000),
        },
      });
      return ticketId;
    });

    this.events.emit(TICKET_CREATED, { ticketId: id, userId });
    return this.detail(userId, id);
  }

  async reply(userId: string, id: string, dto: TicketMessageDto): Promise<TicketDetail> {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id, userId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === TicketStatus.CLOSED) {
      throw new ConflictException(
        'This request is closed. Open a new request and mention this ticket number.',
      );
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true },
    });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          ticketId: id,
          authorType: TicketAuthor.CUSTOMER,
          authorName: user.fullName,
          body: dto.body,
          createdAt: now,
        },
        select: { id: true },
      });
      await this.attach(tx, userId, id, message.id, dto.attachmentIds);
      // A reply reopens a resolved request and puts it back in the agents' queue.
      await tx.supportTicket.update({
        where: { id },
        data: { status: TicketStatus.OPEN, lastMessageAt: now, resolvedAt: null },
      });
    });
    this.events.emit(TICKET_CUSTOMER_REPLIED, { ticketId: id, userId });
    return this.detail(userId, id);
  }

  /** The customer marks the problem as solved. */
  async resolve(userId: string, id: string): Promise<TicketDetail> {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id, userId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!OPEN_STATUSES.includes(ticket.status)) return this.detail(userId, id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.supportTicket.update({
        where: { id },
        data: { status: TicketStatus.RESOLVED, resolvedAt: now },
      }),
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorType: TicketAuthor.SYSTEM,
          authorName: 'Trustlon Support',
          body: 'You marked this request as resolved.',
          createdAt: now,
        },
      }),
    ]);
    return this.detail(userId, id);
  }

  async upload(
    userId: string,
    file: UploadedTicketFile | undefined,
  ): Promise<{ id: string; fileName: string }> {
    if (!file?.buffer?.length)
      throw new BadRequestException({ message: 'Choose a file to upload', field: 'file' });
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException({ message: 'Files must be 5 MB or smaller', field: 'file' });
    }
    const type = detectFileType(file.buffer);
    if (!type || type.kind === 'video') {
      throw new BadRequestException({
        message: 'Attach a JPG, PNG or WebP image, or a PDF',
        field: 'file',
      });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.ticketAttachment.count({
      where: { userId, messageId: null, createdAt: { gte: since } },
    });
    if (recent >= MAX_DAILY_UPLOADS)
      throw new ConflictException('Too many uploads today. Try again tomorrow.');

    const id = randomUUID();
    const storageKey = `support/${userId}/${id}.${type.extension}`;
    const fileName = safeFileName(file.originalname, type.extension);
    await this.storage.put(storageKey, file.buffer);
    await this.prisma.ticketAttachment.create({
      data: {
        id,
        userId,
        fileName,
        storageKey,
        contentType: type.contentType,
        sizeBytes: file.size,
      },
    });
    return { id, fileName };
  }

  /** The ticket owner can open any file in their ticket, including files agents attach. */
  async attachment(
    userId: string,
    id: string,
  ): Promise<{ content: Buffer; contentType: string; fileName: string }> {
    const file = await this.prisma.ticketAttachment.findFirst({
      where: { id, OR: [{ userId }, { ticket: { userId } }] },
    });
    if (!file) throw new NotFoundException('File not found');
    return {
      content: await this.storage.read(file.storageKey),
      contentType: file.contentType,
      fileName: file.fileName,
    };
  }

  private async attach(
    tx: Prisma.TransactionClient,
    userId: string,
    ticketId: string,
    messageId: string,
    attachmentIds: string[],
  ): Promise<void> {
    if (!attachmentIds.length) return;
    const attached = await tx.ticketAttachment.updateMany({
      where: { id: { in: attachmentIds }, userId, messageId: null },
      data: { ticketId, messageId },
    });
    if (attached.count !== attachmentIds.length) {
      throw new BadRequestException({
        message: 'One of the files could not be found. Upload it again.',
        field: 'attachmentIds',
      });
    }
  }

  /** Resolved requests close for replies after the reopen window. */
  private async closeStale(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.supportTicket.updateMany({
      where: { userId, status: TicketStatus.RESOLVED, resolvedAt: { lte: cutoff } },
      data: { status: TicketStatus.CLOSED, closedAt: new Date() },
    });
  }
}
