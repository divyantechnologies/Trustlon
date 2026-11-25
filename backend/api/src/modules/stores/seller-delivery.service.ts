import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PincodeService } from '../location/pincode.service';
import { SellerDeliveryDto } from './dto';

const settingsSelect = {
  id: true,
  displayName: true,
  pickupAddress: true,
  pickupPincode: true,
  pickupLat: true,
  pickupLng: true,
  sameDayDelivery: true,
  nextDayDelivery: true,
  deliveryCutoffTime: true,
} as const;

@Injectable()
export class SellerDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pincodes: PincodeService,
  ) {}

  async list(ownerId: string) {
    return {
      items: await this.prisma.vendor.findMany({
        where: { ownerId, deletedAt: null },
        select: settingsSelect,
        orderBy: { displayName: 'asc' },
      }),
    };
  }

  async save(ownerId: string, id: string, dto: SellerDeliveryDto) {
    const owned = await this.prisma.vendor.findFirst({
      where: { id, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Store not found');
    const pickup = await this.pincodes.find(dto.pickupPincode);
    if (!pickup || pickup.latitude == null || pickup.longitude == null) {
      throw new BadRequestException({
        statusCode: 400,
        field: 'pickupPincode',
        message: 'This pickup pincode has no location coordinates. Choose a supported pincode.',
      });
    }
    const result = await this.prisma.vendor.updateMany({
      where: { id, ownerId, deletedAt: null },
      data: {
        ...dto,
        deliveryCutoffTime: dto.deliveryCutoffTime ?? null,
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
      },
    });
    if (!result.count) throw new NotFoundException('Store not found');
    return this.prisma.vendor.findFirstOrThrow({
      where: { id, ownerId, deletedAt: null },
      select: settingsSelect,
    });
  }
}
