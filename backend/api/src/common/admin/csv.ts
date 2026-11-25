import type { Response } from 'express';

/** Excel-safe CSV: quotes every cell and neutralises formulas (=, +, -, @). */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
  const cell = (value: string | number | boolean | null | undefined) => {
    if (value === null || value === undefined) return '""';
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '﻿' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

export function sendCsv(res: Response, fileName: string, csv: string): string {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'private, no-store',
  });
  return csv;
}

/** Limit for one export, so a request can't pull the whole database. */
export const EXPORT_LIMIT = 10_000;
