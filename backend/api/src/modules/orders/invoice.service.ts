import { Injectable, NotFoundException } from '@nestjs/common';
import { PdfColor, PdfDocument } from '../../common/pdf/pdf-document';
import { rupeesInWords } from '../../common/utils/amount-in-words';
import { splitGst } from '../../common/utils/gst';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_METHOD_LABELS, toShippingAddress } from './order.presenter';

const NAVY: PdfColor = [0.075, 0.137, 0.247];
const TEAL: PdfColor = [0.122, 0.62, 0.549];
const MUTED: PdfColor = [0.39, 0.45, 0.55];
const RULE: PdfColor = [0.85, 0.87, 0.9];
const PANEL: PdfColor = [0.933, 0.949, 0.973];

const MARGIN = 40;

const money = (paise: number) =>
  `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (date: Date) =>
  date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

export interface InvoiceFile {
  fileName: string;
  content: Buffer;
}

/** Tax invoice for one sub-order, issued by the seller once the item ships. */
@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async pdf(userId: string, subOrderId: string): Promise<InvoiceFile> {
    const subOrder = await this.prisma.subOrder.findFirst({
      where: { id: subOrderId, order: { userId } },
      include: {
        order: true,
        items: { orderBy: { productName: 'asc' } },
        vendor: {
          select: {
            displayName: true,
            legalName: true,
            gstin: true,
            pickup: { select: { pincode: true, area: true, city: true, state: true } },
          },
        },
      },
    });
    if (!subOrder) throw new NotFoundException('Order not found');
    if (!subOrder.invoiceNumber) {
      throw new NotFoundException('The invoice is available once this item has shipped');
    }

    const address = toShippingAddress(subOrder.order.shippingAddress);
    const sellerState = subOrder.vendor.pickup?.state ?? null;
    const intraState = Boolean(
      sellerState && address.state && sellerState.toLowerCase() === address.state.toLowerCase(),
    );

    const doc = new PdfDocument({ title: `Tax invoice ${subOrder.invoiceNumber}` });
    const right = doc.width - MARGIN;
    let y = MARGIN + 18;

    // Header
    doc.text('Trustlon', MARGIN, y, { size: 20, font: 'bold', color: NAVY });
    doc.text('TAX INVOICE', right, y, { size: 14, font: 'bold', color: NAVY, align: 'right' });
    y += 14;
    doc.text('Marketplace order · trustlon.com', MARGIN, y, { size: 8.5, color: MUTED });
    doc.text('Original for recipient', right, y, { size: 8.5, color: MUTED, align: 'right' });
    y += 14;
    doc.rect(MARGIN, y, right - MARGIN, 2, TEAL);
    y += 22;

    // Invoice facts
    const facts: Array<[string, string]> = [
      ['Invoice number', subOrder.invoiceNumber],
      ['Invoice date', day(subOrder.invoicedAt ?? subOrder.shippedAt ?? subOrder.createdAt)],
      ['Order number', subOrder.order.orderNumber],
      ['Order date', day(subOrder.order.placedAt)],
      ['Sub-order', subOrder.subOrderNumber],
      ['Payment', PAYMENT_METHOD_LABELS[subOrder.order.paymentMethod]],
    ];
    const columnWidth = (right - MARGIN) / 3;
    facts.forEach(([label, value], index) => {
      const x = MARGIN + (index % 3) * columnWidth;
      const rowY = y + Math.floor(index / 3) * 30;
      doc.text(label.toUpperCase(), x, rowY, { size: 7, color: MUTED, font: 'bold' });
      doc.text(value, x, rowY + 12, { size: 9.5, color: NAVY });
    });
    y += 66;

    // Parties
    const half = (right - MARGIN) / 2;
    const sellerLines = [
      subOrder.vendor.legalName ?? subOrder.vendor.displayName,
      ...(subOrder.vendor.pickup
        ? [
            [subOrder.vendor.pickup.area, subOrder.vendor.pickup.city].filter(Boolean).join(', '),
            `${subOrder.vendor.pickup.state} ${subOrder.vendor.pickup.pincode}`,
          ]
        : []),
      ...(subOrder.vendor.gstin ? [`GSTIN ${subOrder.vendor.gstin}`] : []),
    ];
    const buyerLines = [
      address.name,
      address.line1,
      ...(address.line2 ? [address.line2] : []),
      ...(address.landmark ? [address.landmark] : []),
      `${address.city}, ${address.state} ${address.pincode}`,
      address.mobile ? `Mobile ${address.mobile}` : '',
    ].filter(Boolean);
    const partyHeight = 22 + Math.max(sellerLines.length, buyerLines.length) * 12;
    doc.rect(MARGIN, y, right - MARGIN, partyHeight, PANEL);
    doc.text('SOLD BY', MARGIN + 12, y + 16, { size: 7, color: MUTED, font: 'bold' });
    doc.text('SHIP TO', MARGIN + half + 12, y + 16, { size: 7, color: MUTED, font: 'bold' });
    sellerLines.forEach((line, index) =>
      doc.text(line, MARGIN + 12, y + 30 + index * 12, {
        size: 9,
        color: NAVY,
        font: index === 0 ? 'bold' : 'regular',
      }),
    );
    buyerLines.forEach((line, index) =>
      doc.text(line, MARGIN + half + 12, y + 30 + index * 12, {
        size: 9,
        color: NAVY,
        font: index === 0 ? 'bold' : 'regular',
      }),
    );
    y += partyHeight + 24;

    // Items table
    const columns = [
      { label: '#', width: 20, align: 'left' as const },
      { label: 'Item', width: 165, align: 'left' as const },
      { label: 'HSN', width: 45, align: 'left' as const },
      { label: 'Qty', width: 30, align: 'right' as const },
      { label: 'Unit price', width: 65, align: 'right' as const },
      { label: 'Taxable value', width: 68, align: 'right' as const },
      { label: intraState ? 'CGST + SGST' : 'IGST', width: 64, align: 'right' as const },
      { label: 'Total', width: right - MARGIN - 457, align: 'right' as const },
    ];
    const columnX: number[] = [];
    columns.reduce((x, column) => {
      columnX.push(x);
      return x + column.width;
    }, MARGIN);
    const cellX = (index: number) =>
      columns[index].align === 'right'
        ? columnX[index] + columns[index].width - 4
        : columnX[index] + 4;

    doc.rect(MARGIN, y, right - MARGIN, 20, NAVY);
    columns.forEach((column, index) =>
      doc.text(column.label, cellX(index), y + 13, {
        size: 7.5,
        font: 'bold',
        color: [1, 1, 1],
        align: column.align,
      }),
    );
    y += 20;

    let taxableTotal = 0;
    let gstTotal = 0;
    subOrder.items.forEach((item, index) => {
      const lineTotal = item.unitPricePaise * item.quantity;
      const { taxablePaise, gstPaise } = splitGst(lineTotal, item.gstRateBps);
      taxableTotal += taxablePaise;
      gstTotal += gstPaise;
      const rate = item.gstRateBps / 100;
      const nameLines = doc.wrap(item.productName, columns[1].width - 8, 8.5);
      const rowHeight = Math.max(26, 12 + nameLines.length * 11);

      if (y + rowHeight > doc.height - 200) {
        doc.addPage();
        y = MARGIN;
      }
      const baseline = y + 15;
      doc.text(String(index + 1), cellX(0), baseline, { size: 8.5, color: NAVY });
      nameLines.forEach((line, lineIndex) =>
        doc.text(line, cellX(1), baseline + lineIndex * 11, { size: 8.5, color: NAVY }),
      );
      doc.text(item.hsnCode ?? '-', cellX(2), baseline, { size: 8.5, color: NAVY });
      doc.text(String(item.quantity), cellX(3), baseline, {
        size: 8.5,
        color: NAVY,
        align: 'right',
      });
      doc.text(money(item.unitPricePaise), cellX(4), baseline, {
        size: 8.5,
        color: NAVY,
        align: 'right',
      });
      doc.text(money(taxablePaise), cellX(5), baseline, { size: 8.5, color: NAVY, align: 'right' });
      doc.text(intraState ? `${rate / 2}% + ${rate / 2}%` : `${rate}%`, cellX(6), baseline, {
        size: 8.5,
        color: NAVY,
        align: 'right',
      });
      doc.text(money(lineTotal), cellX(7), baseline, { size: 8.5, color: NAVY, align: 'right' });
      y += rowHeight;
      doc.line(MARGIN, y, right, y, RULE);
    });

    // Totals
    y += 18;
    const labelX = right - 190;
    const totals: Array<[string, string, boolean]> = [
      ['Taxable value', money(taxableTotal), false],
      ...(intraState
        ? ([
            ['CGST', money(Math.floor(gstTotal / 2)), false],
            ['SGST', money(gstTotal - Math.floor(gstTotal / 2)), false],
          ] as Array<[string, string, boolean]>)
        : ([['IGST', money(gstTotal), false]] as Array<[string, string, boolean]>)),
      ['Delivery', subOrder.deliveryPaise ? money(subOrder.deliveryPaise) : 'Free', false],
      ...(subOrder.couponDiscountPaise
        ? ([['Coupon discount', `- ${money(subOrder.couponDiscountPaise)}`, false]] as Array<
            [string, string, boolean]
          >)
        : []),
    ];
    totals.forEach(([label, value]) => {
      doc.text(label, labelX, y, { size: 9, color: MUTED });
      doc.text(value, right, y, { size: 9, color: NAVY, align: 'right' });
      y += 15;
    });
    doc.line(labelX, y - 6, right, y - 6, RULE);
    y += 8;
    doc.text('Invoice total', labelX, y, { size: 11, font: 'bold', color: NAVY });
    doc.text(money(subOrder.totalPaise), right, y, {
      size: 11,
      font: 'bold',
      color: NAVY,
      align: 'right',
    });
    y += 22;

    const words = doc.wrap(
      `Amount in words: ${rupeesInWords(subOrder.totalPaise)}`,
      right - MARGIN,
      8.5,
    );
    words.forEach((line) => {
      doc.text(line, MARGIN, y, { size: 8.5, color: NAVY });
      y += 12;
    });

    // Footer
    const footerY = doc.height - MARGIN - 30;
    doc.line(MARGIN, footerY - 14, right, footerY - 14, RULE);
    doc.text(
      'Prices include GST. Tax is charged by the seller named above. Trustlon is the marketplace operator.',
      MARGIN,
      footerY,
      { size: 7.5, color: MUTED },
    );
    doc.text(
      'This is a computer-generated invoice and does not need a signature.',
      MARGIN,
      footerY + 11,
      { size: 7.5, color: MUTED },
    );
    doc.text('Need help? trustlon.com/help', MARGIN, footerY + 22, { size: 7.5, color: MUTED });

    return {
      fileName: `Trustlon-Invoice-${subOrder.invoiceNumber.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`,
      content: doc.toBuffer(),
    };
  }
}
