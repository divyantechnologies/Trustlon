/**
 * Imports India Post's "All India Pincode Directory" into the pincode master.
 *
 *   1. Download the CSV from https://www.data.gov.in (search "All India Pincode Directory").
 *   2. npm run location:pincodes -w backend -- path/to/pincodes.csv [--serviceable]
 *
 * Columns used (any order, case-insensitive): pincode, officename, district, statename,
 * delivery, latitude, longitude. Existing pincodes keep their delivery settings; only the
 * area, city, state and coordinates are refreshed. New pincodes are address data only unless
 * --serviceable is given, because delivery coverage comes from the courier partners.
 */
import { PrismaClient } from '@prisma/client';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { canonicalState } from '../src/modules/hyperlocal/location/pincode.service';

interface Row {
  pincode: string;
  area: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  delivery: boolean;
}

/** Splits one CSV line, honouring double quotes. */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      out.push(field);
      field = '';
    } else field += char;
  }
  out.push(field);
  return out.map((value) => value.trim());
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /(^|[\s(-])([a-z])/g,
      (_, before: string, letter: string) => before + letter.toUpperCase(),
    )
    .trim();

const coordinate = (value: string | undefined, min: number, max: number) => {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

async function main() {
  const file = process.argv.find((arg) => arg.endsWith('.csv'));
  const serviceable = process.argv.includes('--serviceable');
  if (!file) throw new Error('Pass the path to the pincode CSV file.');

  const byPincode = new Map<string, Row>();
  let header: string[] | null = null;
  let skipped = 0;
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitCsv(line.replace(/^﻿/, ''));
    if (!header) {
      header = cells.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''));
      continue;
    }
    const get = (name: string) => cells[header!.indexOf(name)];
    const pincode = get('pincode');
    const state = canonicalState(get('statename') ?? '');
    const district = get('district') ?? get('districtname');
    if (!pincode || !/^[1-9]\d{5}$/.test(pincode) || !state || !district) {
      skipped++;
      continue;
    }
    const delivery = /^delivery$/i.test(get('delivery') ?? get('deliverystatus') ?? '');
    const current = byPincode.get(pincode);
    // Prefer a delivery post office for the area name and coordinates.
    if (!current || (delivery && !current.delivery)) {
      byPincode.set(pincode, {
        pincode,
        area: get('officename')
          ? titleCase(
              get('officename')!.replace(/\s+(B\.?O|S\.?O|H\.?O|G\.?P\.?O)\.?$/i, ''),
            ).slice(0, 120)
          : null,
        city: titleCase(district).slice(0, 80),
        state,
        latitude: coordinate(get('latitude'), 6, 38),
        longitude: coordinate(get('longitude'), 68, 98),
        delivery,
      });
    }
  }

  const prisma = new PrismaClient();
  const rows = [...byPincode.values()];
  let created = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    const result = await prisma.pincode.createMany({
      data: batch.map(({ delivery: _delivery, ...row }) => ({
        ...row,
        serviceable,
        codAvailable: serviceable,
      })),
      skipDuplicates: true,
    });
    created += result.count;
    for (const row of batch) {
      await prisma.pincode.updateMany({
        where: { pincode: row.pincode },
        data: {
          area: row.area,
          city: row.city,
          state: row.state,
          ...(row.latitude !== null && row.longitude !== null
            ? { latitude: row.latitude, longitude: row.longitude }
            : {}),
        },
      });
    }
    process.stdout.write(`\r${Math.min(i + 1000, rows.length)} / ${rows.length}`);
  }
  console.log(`\nPincodes: ${rows.length} read, ${created} new, ${skipped} rows skipped.`);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
