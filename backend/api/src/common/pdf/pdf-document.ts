/**
 * Small PDF writer for documents the API generates (tax invoices, statements).
 * Uses the built-in Helvetica fonts, so no font files or third-party packages are needed.
 * Text is limited to the Windows-1252 character set; other characters are replaced.
 */

export type PdfFont = 'regular' | 'bold';
export type PdfColor = readonly [number, number, number];

export interface TextOptions {
  size?: number;
  font?: PdfFont;
  color?: PdfColor;
  align?: 'left' | 'right' | 'center';
}

export const A4 = { width: 595.28, height: 841.89 } as const;

const BLACK: PdfColor = [0, 0, 0];

/** Glyph widths (1/1000 em) for characters 32-126 and 160-255. */
const WIDTHS: Record<PdfFont, number[]> = {
  regular: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
    611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
    222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  bold: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
    611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
    278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
};

const LATIN1_WIDTHS: Record<PdfFont, number[]> = {
  regular: [
    278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333,
    333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667,
    1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778,
    722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556,
    278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556,
    500,
  ],
  bold: [
    278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333,
    333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722,
    1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778,
    722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556,
    278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611,
    556,
  ],
};

const REPLACEMENTS: Record<string, string> = {
  '₹': 'Rs.',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  '•': '·',
  ' ': ' ',
};

/** Maps text to characters the standard fonts can draw. */
export function pdfSafeText(text: string): string {
  let out = '';
  for (const char of text.normalize('NFC')) {
    const replaced = REPLACEMENTS[char] ?? char;
    for (const c of replaced) {
      const code = c.charCodeAt(0);
      if (c === '\n' || c === '\t') out += ' ';
      else if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) out += c;
      else out += '?';
    }
  }
  return out;
}

function charWidth(code: number, font: PdfFont): number {
  if (code >= 32 && code <= 126) return WIDTHS[font][code - 32];
  if (code >= 160 && code <= 255) return LATIN1_WIDTHS[font][code - 160];
  return 556;
}

function escapeText(text: string): string {
  let out = '';
  for (const c of text) {
    const code = c.charCodeAt(0);
    if (c === '\\' || c === '(' || c === ')') out += `\\${c}`;
    else if (code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += c;
  }
  return out;
}

const num = (value: number) => (Math.round(value * 100) / 100).toString();
const rgb = (color: PdfColor) => color.map((part) => num(part)).join(' ');

/** A4 document. Coordinates are in points, measured from the top-left corner. */
export class PdfDocument {
  private readonly pages: string[][] = [];
  private current: string[];

  constructor(private readonly info: { title: string; author?: string }) {
    this.current = [];
    this.pages.push(this.current);
  }

  get width(): number {
    return A4.width;
  }

  get height(): number {
    return A4.height;
  }

  addPage(): void {
    this.current = [];
    this.pages.push(this.current);
  }

  measure(text: string, size: number, font: PdfFont = 'regular'): number {
    let total = 0;
    for (const c of pdfSafeText(text)) total += charWidth(c.charCodeAt(0), font);
    return (total * size) / 1000;
  }

  /** Splits text into lines no wider than `width`, breaking at spaces where possible. */
  wrap(text: string, width: number, size: number, font: PdfFont = 'regular'): string[] {
    const words = pdfSafeText(text).split(' ').filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.measure(candidate, size, font) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (this.measure(line, size, font) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && this.measure(line.slice(0, cut), size, font) > width) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /** Draws one line of text. `y` is the baseline, measured from the top of the page. */
  text(text: string, x: number, y: number, options: TextOptions = {}): void {
    const size = options.size ?? 10;
    const font = options.font ?? 'regular';
    const safe = pdfSafeText(text);
    const width = this.measure(safe, size, font);
    const left =
      options.align === 'right' ? x - width : options.align === 'center' ? x - width / 2 : x;
    this.current.push(
      `BT /${font === 'bold' ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(options.color ?? BLACK)} rg ${num(left)} ${num(
        this.height - y,
      )} Td (${escapeText(safe)}) Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = BLACK, width = 0.5): void {
    this.current.push(
      `${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S`,
    );
  }

  /** Filled rectangle; `y` is the top edge. */
  rect(x: number, y: number, width: number, height: number, fill: PdfColor): void {
    this.current.push(
      `${rgb(fill)} rg ${num(x)} ${num(this.height - y - height)} ${num(width)} ${num(height)} re f`,
    );
  }

  toBuffer(): Buffer {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = add('');
    const pagesId = add('');
    const regularId = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    );
    const boldId = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    );

    const pageIds = this.pages.map((ops) => {
      const stream = ops.join('\n');
      const contentId = add(
        `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
      );
      return add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] ` +
          `/Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] =
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const infoId = add(
      `<< /Title (${escapeText(pdfSafeText(this.info.title))}) /Author (${escapeText(
        pdfSafeText(this.info.author ?? 'Trustlon'),
      )}) /Producer (Trustlon) /CreationDate (D:${stamp}Z) >>`,
    );

    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(out, 'latin1'));
      out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}
