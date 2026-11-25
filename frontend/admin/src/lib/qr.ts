/**
 * Minimal QR code encoder (ISO/IEC 18004): byte mode, error correction level M, versions 1–15.
 * Enough for an otpauth:// link, so staff can scan it into an authenticator app without the
 * secret leaving the browser.
 */

// [total codewords, EC codewords per block, [blocks, data codewords per block]...]
const VERSIONS: Array<[number, number, Array<[number, number]>]> = [
  [26, 10, [[1, 16]]],
  [44, 16, [[1, 28]]],
  [70, 26, [[1, 44]]],
  [100, 18, [[2, 32]]],
  [134, 24, [[2, 43]]],
  [172, 16, [[4, 27]]],
  [196, 18, [[4, 31]]],
  [
    242,
    22,
    [
      [2, 38],
      [2, 39],
    ],
  ],
  [
    292,
    22,
    [
      [3, 36],
      [2, 37],
    ],
  ],
  [
    346,
    26,
    [
      [4, 43],
      [1, 44],
    ],
  ],
  [
    404,
    30,
    [
      [1, 50],
      [4, 51],
    ],
  ],
  [
    466,
    22,
    [
      [6, 36],
      [2, 37],
    ],
  ],
  [
    532,
    22,
    [
      [8, 37],
      [1, 38],
    ],
  ],
  [
    581,
    24,
    [
      [4, 40],
      [5, 41],
    ],
  ],
  [
    655,
    24,
    [
      [5, 41],
      [5, 42],
    ],
  ],
];

const ALIGNMENT: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
];

/* Galois field GF(256) with polynomial 0x11d. */
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data: number[], degree: number): number[] {
  const gen = generator(degree);
  const result = [...data, ...new Array<number>(degree).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = result[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) result[i + j] ^= mul(gen[j], factor);
  }
  return result.slice(data.length);
}

/** Appends a BCH remainder (format and version information). */
function bch(value: number, poly: number, degree: number): number {
  let rem = value;
  for (let i = 0; i < degree; i += 1) rem = (rem << 1) ^ ((rem >>> (degree - 1)) * poly);
  return (value << degree) | (rem & ((1 << degree) - 1));
}

export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  for (let v = 1; v <= VERSIONS.length; v += 1) {
    const capacity = VERSIONS[v - 1][2].reduce((sum, [n, k]) => sum + n * k, 0);
    const needed = Math.ceil((4 + (v < 10 ? 8 : 16) + bytes.length * 8) / 8);
    if (needed <= capacity) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error('Text too long for a QR code');
  const [, ecPerBlock, groups] = VERSIONS[version - 1];
  const capacity = groups.reduce((sum, [n, k]) => sum + n * k, 0);

  // Bit stream: mode 0100 (byte), length, data, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0; data.length < capacity; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);

  // Split into blocks, add error correction, interleave.
  const blocks: number[][] = [];
  let offset = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i += 1) {
      blocks.push(data.slice(offset, offset + size));
      offset += size;
    }
  }
  const ecBlocks = blocks.map((block) => errorCorrection(block, ecPerBlock));
  const codewords: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i += 1)
    for (const block of blocks) if (i < block.length) codewords.push(block[i]);
  for (let i = 0; i < ecPerBlock; i += 1) for (const block of ecBlocks) codewords.push(block[i]);

  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const set = (r: number, c: number, dark: boolean) => {
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  // Finder patterns with separators.
  for (const [row, col] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inside &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(rr, cc, dark);
      }
    }
  }
  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // Alignment patterns.
  const centres = ALIGNMENT[version - 1];
  const last = centres[centres.length - 1];
  for (const r of centres) {
    for (const c of centres) {
      // The three positions under the finder patterns are skipped.
      if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }
  // Dark module and reserved format/version areas.
  set(size - 8, 8, true);
  for (let i = 0; i < 9; i += 1) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }
    }
  }

  // Data placement: two-column zigzag from the bottom right, skipping the timing column.
  const dataBits: number[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i -= 1) dataBits.push((cw >>> i) & 1);
  let index = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        modules[row][col] = index < dataBits.length ? dataBits[index] === 1 : false;
        index += 1;
      }
    }
    upward = !upward;
  }

  const MASKS: Array<(r: number, c: number) => boolean> = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  const withFormat = (grid: boolean[][], mask: number) => {
    // Level M is 00; then the mask number.
    const format = bch(mask, 0x537, 10) ^ 0x5412;
    const bit = (i: number) => ((format >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i += 1) grid[i][8] = bit(i);
    grid[7][8] = bit(6);
    grid[8][8] = bit(7);
    grid[8][7] = bit(8);
    for (let i = 9; i < 15; i += 1) grid[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i += 1) grid[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i += 1) grid[size - 15 + i][8] = bit(i);
    grid[size - 8][8] = true;
    if (version >= 7) {
      const info = bch(version, 0x1f25, 12);
      for (let i = 0; i < 18; i += 1) {
        const dark = ((info >>> i) & 1) === 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        grid[b][a] = dark;
        grid[a][b] = dark;
      }
    }
    return grid;
  };

  const penalty = (grid: boolean[][]) => {
    let score = 0;
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < size; i += 1) {
        let run = 1;
        for (let j = 1; j < size; j += 1) {
          const same = pass ? grid[j][i] === grid[j - 1][i] : grid[i][j] === grid[i][j - 1];
          if (same) {
            run += 1;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else run = 1;
        }
        for (let j = 0; j + 10 < size; j += 1) {
          const line = Array.from({ length: 11 }, (_, k) =>
            pass ? grid[j + k][i] : grid[i][j + k],
          );
          const p = line.map((d) => (d ? 1 : 0)).join('');
          if (p === '10111010000' || p === '00001011101') score += 40;
        }
      }
    }
    for (let r = 0; r < size - 1; r += 1) {
      for (let c = 0; c < size - 1; c += 1) {
        const d = grid[r][c];
        if (d === grid[r + 1][c] && d === grid[r][c + 1] && d === grid[r + 1][c + 1]) score += 3;
      }
    }
    const dark = grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return score;
  };

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const grid = modules.map((row, r) =>
      row.map((dark, c) => (reserved[r][c] ? dark : dark !== MASKS[mask](r, c))),
    );
    withFormat(grid, mask);
    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid;
    }
  }
  return best as boolean[][];
}

/** SVG path data for the dark modules, with a 4-module quiet zone. */
export function qrPath(text: string): { path: string; size: number } {
  const grid = encodeQr(text);
  const size = grid.length + 8;
  let path = '';
  grid.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) path += `M${c + 4},${r + 4}h1v1h-1z`;
    }),
  );
  return { path, size };
}
