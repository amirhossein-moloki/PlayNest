import zlib from 'zlib';
import sharp from 'sharp';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type QrOutputFormat = 'svg' | 'png' | 'json' | 'dataurl';

export interface QrRenderOptions {
  format?: QrOutputFormat;
  size?: number;
  margin?: number;
  errorCorrectionLevel?: QrErrorCorrectionLevel;
  foreground?: string;
  background?: string;
}

export interface QrMatrixResult {
  version: number;
  size: number;
  ecc: QrErrorCorrectionLevel;
  modules: boolean[][];
}

export interface QrGeneratedOutput {
  format: QrOutputFormat;
  mimeType: string;
  buffer?: Buffer;
  svg?: string;
  dataUrl?: string;
  meta: {
    shortUrl: string;
    version: number;
    moduleCount: number;
    size: number;
    margin: number;
    ecc: QrErrorCorrectionLevel;
    foreground: string;
    background: string;
  };
}

interface EccBlockSpec {
  ecPerBlock: number;
  g1Blocks: number;
  g1Data: number;
  g2Blocks: number;
  g2Data: number;
}

// ISO/IEC 18004 Version 1..10 Error Correction & Block Specs
const QR_SPECS: Record<number, Record<QrErrorCorrectionLevel, EccBlockSpec>> = {
  1: {
    L: { ecPerBlock: 7, g1Blocks: 1, g1Data: 19, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 13, g1Blocks: 1, g1Data: 13, g2Blocks: 0, g2Data: 0 },
    H: { ecPerBlock: 17, g1Blocks: 1, g1Data: 9, g2Blocks: 0, g2Data: 0 },
  },
  2: {
    L: { ecPerBlock: 10, g1Blocks: 1, g1Data: 34, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 22, g1Blocks: 1, g1Data: 22, g2Blocks: 0, g2Data: 0 },
    H: { ecPerBlock: 28, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0 },
  },
  3: {
    L: { ecPerBlock: 15, g1Blocks: 1, g1Data: 55, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 18, g1Blocks: 2, g1Data: 17, g2Blocks: 0, g2Data: 0 },
    H: { ecPerBlock: 22, g1Blocks: 2, g1Data: 13, g2Blocks: 0, g2Data: 0 },
  },
  4: {
    L: { ecPerBlock: 20, g1Blocks: 1, g1Data: 80, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 26, g1Blocks: 2, g1Data: 24, g2Blocks: 0, g2Data: 0 },
    H: { ecPerBlock: 16, g1Blocks: 4, g1Data: 9, g2Blocks: 0, g2Data: 0 },
  },
  5: {
    L: { ecPerBlock: 26, g1Blocks: 1, g1Data: 108, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 18, g1Blocks: 2, g1Data: 15, g2Blocks: 2, g2Data: 16 },
    H: { ecPerBlock: 22, g1Blocks: 2, g1Data: 11, g2Blocks: 2, g2Data: 12 },
  },
  6: {
    L: { ecPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 24, g1Blocks: 4, g1Data: 19, g2Blocks: 0, g2Data: 0 },
    H: { ecPerBlock: 28, g1Blocks: 4, g1Data: 15, g2Blocks: 0, g2Data: 0 },
  },
  7: {
    L: { ecPerBlock: 20, g1Blocks: 2, g1Data: 78, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0 },
    Q: { ecPerBlock: 18, g1Blocks: 2, g1Data: 14, g2Blocks: 4, g2Data: 15 },
    H: { ecPerBlock: 26, g1Blocks: 4, g1Data: 13, g2Blocks: 1, g2Data: 14 },
  },
  8: {
    L: { ecPerBlock: 24, g1Blocks: 2, g1Data: 97, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39 },
    Q: { ecPerBlock: 22, g1Blocks: 4, g1Data: 18, g2Blocks: 2, g2Data: 19 },
    H: { ecPerBlock: 26, g1Blocks: 4, g1Data: 14, g2Blocks: 2, g2Data: 15 },
  },
  9: {
    L: { ecPerBlock: 30, g1Blocks: 2, g1Data: 116, g2Blocks: 0, g2Data: 0 },
    M: { ecPerBlock: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37 },
    Q: { ecPerBlock: 20, g1Blocks: 4, g1Data: 16, g2Blocks: 4, g2Data: 17 },
    H: { ecPerBlock: 24, g1Blocks: 4, g1Data: 12, g2Blocks: 4, g2Data: 13 },
  },
  10: {
    L: { ecPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 2, g2Data: 69 },
    M: { ecPerBlock: 26, g1Blocks: 4, g1Data: 43, g2Blocks: 1, g2Data: 44 },
    Q: { ecPerBlock: 24, g1Blocks: 6, g1Data: 19, g2Blocks: 2, g2Data: 20 },
    H: { ecPerBlock: 28, g1Blocks: 6, g1Data: 15, g2Blocks: 2, g2Data: 16 },
  },
};

const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const REMAINDER_BITS: Record<number, number> = {
  1: 0,
  2: 7,
  3: 7,
  4: 7,
  5: 7,
  6: 7,
  7: 0,
  8: 0,
  9: 0,
  10: 0,
};

const ECC_BITS: Record<QrErrorCorrectionLevel, number> = {
  L: 1, // 01
  M: 0, // 00
  Q: 3, // 11
  H: 2, // 10
};

// GF(256) log/antilog tables with primitive polynomial 0x11d (285)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGeneratorPoly(ecLength: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < ecLength; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeRsRemainder(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = buildRsGeneratorPoly(ecLength);
  const res = new Uint8Array(data.length + ecLength);
  res.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j += 1) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

function encodeDataBits(bytes: Uint8Array, version: number, totalDataCws: number): number[] {
  const bits: number[] = [];
  const pushBits = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((value >>> i) & 1);
    }
  };

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  const countBits = version < 10 ? 8 : 16;
  pushBits(bytes.length, countBits);

  for (const b of bytes) {
    pushBits(b, 8);
  }

  const maxBits = totalDataCws * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminator; i += 1) {
    bits.push(0);
  }

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx += 1;
  }

  return bits;
}

function selectVersion(byteLength: number, ecc: QrErrorCorrectionLevel): number {
  for (let v = 1; v <= 10; v += 1) {
    const spec = QR_SPECS[v][ecc];
    const totalDataCws = spec.g1Blocks * spec.g1Data + spec.g2Blocks * spec.g2Data;
    const headerBits = 4 + (v < 10 ? 8 : 16);
    const neededBits = headerBits + byteLength * 8;
    if (neededBits <= totalDataCws * 8) {
      return v;
    }
  }
  throw new AppError(
    'Short URL is too long for QR code generation (max Version 10 capacity exceeded).',
    httpStatus.BAD_REQUEST,
    { code: 'QR_PAYLOAD_TOO_LONG' }
  );
}

function bchFormatInfo(ecc: QrErrorCorrectionLevel, maskId: number): number {
  const data = (ECC_BITS[ecc] << 3) | maskId;
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) {
      rem ^= poly << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersionInfo(version: number): number {
  let rem = version << 12;
  const poly = 0x1f25;
  for (let i = 17; i >= 12; i -= 1) {
    if ((rem >>> i) & 1) {
      rem ^= poly << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function createEmptyGrid(size: number): Array<Array<boolean | null>> {
  return Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));
}

function placeFinder(grid: Array<Array<boolean | null>>, isFunc: boolean[][], row: number, col: number) {
  const size = grid.length;
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      let dark = false;
      if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
        dark =
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
      grid[rr][cc] = dark;
      isFunc[rr][cc] = true;
    }
  }
}

function placeAlignment(grid: Array<Array<boolean | null>>, isFunc: boolean[][], centerR: number, centerC: number) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      grid[centerR + r][centerC + c] = dark;
      isFunc[centerR + r][centerC + c] = true;
    }
  }
}

function applyMaskPattern(maskId: number, r: number, c: number): boolean {
  switch (maskId) {
  case 0:
    return (r + c) % 2 === 0;
  case 1:
    return r % 2 === 0;
  case 2:
    return c % 3 === 0;
  case 3:
    return (r + c) % 3 === 0;
  case 4:
    return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
  case 5:
    return ((r * c) % 2) + ((r * c) % 3) === 0;
  case 6:
    return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
  case 7:
    return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  default:
    return false;
  }
}

function evaluatePenaltyScore(modules: boolean[][]): number {
  const n = modules.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules in row/col
  for (let i = 0; i < n; i += 1) {
    let rowRun = 1;
    let colRun = 1;
    for (let j = 1; j < n; j += 1) {
      if (modules[i][j] === modules[i][j - 1]) {
        rowRun += 1;
      } else {
        if (rowRun >= 5) penalty += 3 + (rowRun - 5);
        rowRun = 1;
      }
      if (modules[j][i] === modules[j - 1][i]) {
        colRun += 1;
      } else {
        if (colRun >= 5) penalty += 3 + (colRun - 5);
        colRun = 1;
      }
    }
    if (rowRun >= 5) penalty += 3 + (rowRun - 5);
    if (colRun >= 5) penalty += 3 + (colRun - 5);
  }

  // Rule 2: 2x2 same-color blocks
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns with 4-module white margin
  const checkPattern11311 = (line: boolean[]) => {
    for (let i = 0; i <= line.length - 11; i += 1) {
      if (
        line[i] &&
        !line[i + 1] &&
        line[i + 2] &&
        line[i + 3] &&
        line[i + 4] &&
        !line[i + 5] &&
        line[i + 6] &&
        !line[i + 7] &&
        !line[i + 8] &&
        !line[i + 9] &&
        !line[i + 10]
      ) {
        penalty += 40;
      }
      if (
        !line[i] &&
        !line[i + 1] &&
        !line[i + 2] &&
        !line[i + 3] &&
        line[i + 4] &&
        !line[i + 5] &&
        line[i + 6] &&
        line[i + 7] &&
        line[i + 8] &&
        !line[i + 9] &&
        line[i + 10]
      ) {
        penalty += 40;
      }
    }
  };
  for (let r = 0; r < n; r += 1) {
    checkPattern11311(modules[r]);
  }
  for (let c = 0; c < n; c += 1) {
    const col: boolean[] = [];
    for (let r = 0; r < n; r += 1) col.push(modules[r][c]);
    checkPattern11311(col);
  }

  // Rule 4: dark ratio deviation from 50%
  let darkCount = 0;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (modules[r][c]) darkCount += 1;
    }
  }
  const percent = (darkCount * 100) / (n * n);
  const k = Math.floor(Math.abs(percent - 50) / 5);
  penalty += k * 10;

  return penalty;
}

/**
 * Generates an ISO/IEC 18004 compliant QR module matrix for any URL string.
 */
export function generateQrMatrix(
  text: string,
  ecc: QrErrorCorrectionLevel = 'M'
): QrMatrixResult {
  const bytes = Buffer.from(text, 'utf8');
  const version = selectVersion(bytes.length, ecc);
  const spec = QR_SPECS[version][ecc];
  const totalDataCws = spec.g1Blocks * spec.g1Data + spec.g2Blocks * spec.g2Data;

  const bitStream = encodeDataBits(bytes, version, totalDataCws);
  const dataBytes = new Uint8Array(totalDataCws);
  for (let i = 0; i < totalDataCws; i += 1) {
    let val = 0;
    for (let b = 0; b < 8; b += 1) {
      val = (val << 1) | bitStream[i * 8 + b];
    }
    dataBytes[i] = val;
  }

  // Split into RS blocks & compute EC codewords
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < spec.g1Blocks; i += 1) {
    const blk = dataBytes.slice(offset, offset + spec.g1Data);
    offset += spec.g1Data;
    dataBlocks.push(blk);
    ecBlocks.push(computeRsRemainder(blk, spec.ecPerBlock));
  }
  for (let i = 0; i < spec.g2Blocks; i += 1) {
    const blk = dataBytes.slice(offset, offset + spec.g2Data);
    offset += spec.g2Data;
    dataBlocks.push(blk);
    ecBlocks.push(computeRsRemainder(blk, spec.ecPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(spec.g1Data, spec.g2Data);
  for (let i = 0; i < maxDataLen; i += 1) {
    for (const blk of dataBlocks) {
      if (i < blk.length) finalCodewords.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const ecBlk of ecBlocks) {
      finalCodewords.push(ecBlk[i]);
    }
  }

  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b -= 1) {
      finalBits.push((cw >>> b) & 1);
    }
  }
  const remBits = REMAINDER_BITS[version] ?? 0;
  for (let i = 0; i < remBits; i += 1) {
    finalBits.push(0);
  }

  const size = 4 * version + 17;
  const baseGrid = createEmptyGrid(size);
  const isFunc = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  // Finder patterns + separators
  placeFinder(baseGrid, isFunc, 0, 0);
  placeFinder(baseGrid, isFunc, 0, size - 7);
  placeFinder(baseGrid, isFunc, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    baseGrid[6][i] = dark;
    isFunc[6][i] = true;
    baseGrid[i][6] = dark;
    isFunc[i][6] = true;
  }

  // Alignment patterns
  const centers = ALIGNMENT_CENTERS[version] || [];
  for (const r of centers) {
    for (const c of centers) {
      const overlapsTopLeft = r <= 8 && c <= 8;
      const overlapsTopRight = r <= 8 && c >= size - 9;
      const overlapsBottomLeft = r >= size - 9 && c <= 8;
      if (!overlapsTopLeft && !overlapsTopRight && !overlapsBottomLeft) {
        placeAlignment(baseGrid, isFunc, r, c);
      }
    }
  }

  // Reserve format info cells & dark module
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      isFunc[8][i] = true;
      isFunc[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    isFunc[8][size - 1 - i] = true;
  }
  for (let i = 0; i < 7; i += 1) {
    isFunc[size - 1 - i][8] = true;
  }
  baseGrid[4 * version + 9][8] = true;
  isFunc[4 * version + 9][8] = true;

  // Version info for versions >= 7
  if (version >= 7) {
    const vInfo = bchVersionInfo(version);
    for (let i = 0; i < 18; i += 1) {
      const bit = Boolean((vInfo >>> i) & 1);
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      baseGrid[a][b] = bit;
      isFunc[a][b] = true;
      baseGrid[b][a] = bit;
      isFunc[b][a] = true;
    }
  }

  // Zigzag placement of data bits into non-function modules
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc += 1) {
        const c = col - dc;
        if (!isFunc[r][c]) {
          baseGrid[r][c] = bitIdx < finalBits.length ? finalBits[bitIdx] === 1 : false;
          bitIdx += 1;
        }
      }
    }
    upward = !upward;
  }

  // Choose mask minimizing ISO penalty score
  let bestModules: boolean[][] | null = null;
  let lowestPenalty = Number.POSITIVE_INFINITY;

  for (let maskId = 0; maskId < 8; maskId += 1) {
    const candidate: boolean[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (__, c) => {
        const baseVal = Boolean(baseGrid[r][c]);
        if (isFunc[r][c]) return baseVal;
        return applyMaskPattern(maskId, r, c) ? !baseVal : baseVal;
      })
    );

    const fmt = bchFormatInfo(ecc, maskId);
    for (let i = 0; i < 15; i += 1) {
      const bit = Boolean((fmt >>> i) & 1);
      // Vertical copy 1 (top-left cols 8, rows 0..8 skipping 6) & bottom-left
      if (i < 6) {
        candidate[i][8] = bit;
      } else if (i < 8) {
        candidate[i + 1][8] = bit;
      } else {
        candidate[size - 15 + i][8] = bit;
      }

      // Horizontal copy 2 (top-right + top-left row 8 skipping 6)
      if (i < 8) {
        candidate[8][size - 1 - i] = bit;
      } else if (i < 9) {
        candidate[8][15 - i] = bit;
      } else {
        candidate[8][14 - i] = bit;
      }
    }

    const score = evaluatePenaltyScore(candidate);
    if (score < lowestPenalty) {
      lowestPenalty = score;
      bestModules = candidate;
    }
  }

  return {
    version,
    size,
    ecc,
    modules: bestModules || Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
  };
}

function sanitizeHexColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function buildSvgFromMatrix(
  matrix: QrMatrixResult,
  sizePx: number,
  marginModules: number,
  fg: string,
  bg: string
): string {
  const totalModules = matrix.size + marginModules * 2;
  const pathParts: string[] = [];

  for (let r = 0; r < matrix.size; r += 1) {
    let c = 0;
    while (c < matrix.size) {
      if (!matrix.modules[r][c]) {
        c += 1;
        continue;
      }
      const start = c;
      while (c < matrix.size && matrix.modules[r][c]) {
        c += 1;
      }
      const runLen = c - start;
      pathParts.push(`M${start + marginModules},${r + marginModules}h${runLen}v1h-${runLen}z`);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="${bg}"/>`,
    `<path d="${pathParts.join('')}" fill="${fg}"/>`,
    '</svg>',
  ].join('');
}

function encodePngFallback(
  matrix: QrMatrixResult,
  sizePx: number,
  marginModules: number,
  fgHex: string,
  bgHex: string
): Buffer {
  const totalModules = matrix.size + marginModules * 2;
  const fgRgb = parseHexRgb(fgHex);
  const bgRgb = parseHexRgb(bgHex);
  const scale = sizePx / totalModules;

  const stride = 1 + sizePx * 3;
  const raw = Buffer.alloc(stride * sizePx);

  for (let y = 0; y < sizePx; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // filter None
    const modR = Math.floor(y / scale) - marginModules;
    for (let x = 0; x < sizePx; x += 1) {
      const modC = Math.floor(x / scale) - marginModules;
      const isDark =
        modR >= 0 &&
        modR < matrix.size &&
        modC >= 0 &&
        modC < matrix.size &&
        matrix.modules[modR][modC];
      const [r, g, b] = isDark ? fgRgb : bgRgb;
      const pxOffset = rowOffset + 1 + x * 3;
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
    }
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const makeChunk = (type: string, data: Buffer): Buffer => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(sizePx, 0);
  ihdr.writeUInt32BE(sizePx, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Generates crisp print/download-ready QR Codes (SVG, PNG via sharp or fallback, JSON, DataURL)
 * pointing directly to the stable short link URL so QR stickers stay valid when destinations change.
 */
export async function generateShortLinkQr(
  shortUrl: string,
  options: QrRenderOptions = {}
): Promise<QrGeneratedOutput> {
  const format: QrOutputFormat = options.format || 'svg';
  const size = Math.max(128, Math.min(2048, Math.round(options.size || 320)));
  const margin = Math.max(1, Math.min(10, Math.round(options.margin ?? 4)));
  const ecc: QrErrorCorrectionLevel = options.errorCorrectionLevel || 'M';
  const fg = sanitizeHexColor(options.foreground, '#111827');
  const bg = sanitizeHexColor(options.background, '#FFFFFF');

  const matrix = generateQrMatrix(shortUrl, ecc);
  const svg = buildSvgFromMatrix(matrix, size, margin, fg, bg);

  const meta = {
    shortUrl,
    version: matrix.version,
    moduleCount: matrix.size,
    size,
    margin,
    ecc,
    foreground: fg,
    background: bg,
  };

  if (format === 'svg') {
    return {
      format: 'svg',
      mimeType: 'image/svg+xml; charset=utf-8',
      svg,
      buffer: Buffer.from(svg, 'utf8'),
      meta,
    };
  }

  if (format === 'json') {
    return {
      format: 'json',
      mimeType: 'application/json',
      svg,
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
      meta,
    };
  }

  let pngBuffer: Buffer;
  try {
    pngBuffer = await sharp(Buffer.from(svg, 'utf8'))
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    pngBuffer = encodePngFallback(matrix, size, margin, fg, bg);
  }

  if (format === 'dataurl') {
    return {
      format: 'dataurl',
      mimeType: 'application/json',
      buffer: pngBuffer,
      dataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      meta,
    };
  }

  return {
    format: 'png',
    mimeType: 'image/png',
    buffer: pngBuffer,
    meta,
  };
}
