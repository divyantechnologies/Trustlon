/**
 * Imports cities and towns outside India from GeoNames (CC BY 4.0, credit "GeoNames").
 *
 *   1. Download and unzip https://download.geonames.org/export/dump/cities15000.zip
 *      (cities5000 or cities1000 give more towns).
 *   2. npm run location:cities -w backend -- path/to/cities15000.txt
 */
import { PrismaClient } from '@prisma/client';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { searchKey } from '../src/modules/hyperlocal/location/city-search.service';

async function main() {
  const file = process.argv.find((arg) => arg.endsWith('.txt'));
  if (!file) throw new Error('Pass the path to the GeoNames cities file (.txt).');
  const prisma = new PrismaClient();
  let batch: Array<{
    id: number;
    countryCode: string;
    name: string;
    searchName: string;
    regionCode: string | null;
    population: number;
  }> = [];
  let total = 0;
  const flush = async () => {
    if (!batch.length) return;
    const result = await prisma.city.createMany({ data: batch, skipDuplicates: true });
    total += result.count;
    batch = [];
  };
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    // geonameid, name, asciiname, alternatenames, lat, lng, feature class, feature code,
    // country code, cc2, admin1, admin2, admin3, admin4, population, ...
    const cols = line.split('\t');
    if (cols.length < 15 || cols[6] !== 'P') continue;
    const countryCode = cols[8];
    if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === 'IN') continue;
    batch.push({
      id: Number(cols[0]),
      countryCode,
      name: cols[1].slice(0, 120),
      searchName: searchKey(cols[2] || cols[1]).slice(0, 120),
      regionCode: cols[10] ? cols[10].slice(0, 20) : null,
      population: Number(cols[14]) || 0,
    });
    if (batch.length >= 2000) await flush();
  }
  await flush();
  console.log(`Cities imported: ${total}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
