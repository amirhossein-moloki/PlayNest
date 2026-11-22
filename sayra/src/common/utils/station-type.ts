import { GameStationType } from '@prisma/client';
import { z } from 'zod';

export const PUBLIC_GAME_STATION_TYPES = [
  'PC',
  'PLAYSTATION 4',
  'PLAYSTATION 5',
  'XBOX',
  'SWITCH',
  'VR',
] as const;

export type PublicGameStationType = (typeof PUBLIC_GAME_STATION_TYPES)[number];

const PRISMA_TO_PUBLIC_MAP: Record<string, PublicGameStationType> = {
  PC: 'PC',
  PLAYSTATION_4: 'PLAYSTATION 4',
  'PLAYSTATION 4': 'PLAYSTATION 4',
  PLAYSTATION_5: 'PLAYSTATION 5',
  'PLAYSTATION 5': 'PLAYSTATION 5',
  XBOX: 'XBOX',
  SWITCH: 'SWITCH',
  VR: 'VR',
};

const INPUT_TO_PRISMA_MAP: Record<string, GameStationType> = {
  PC: GameStationType.PC,
  'PLAYSTATION 4': GameStationType.PLAYSTATION_4,
  PLAYSTATION_4: GameStationType.PLAYSTATION_4,
  'PLAYSTATION 5': GameStationType.PLAYSTATION_5,
  PLAYSTATION_5: GameStationType.PLAYSTATION_5,
  XBOX: GameStationType.XBOX,
  SWITCH: GameStationType.SWITCH,
  VR: GameStationType.VR,
};

/**
 * Normalizes public ('PLAYSTATION 4', 'PLAYSTATION 5') or internal ('PLAYSTATION_4', 'PLAYSTATION_5')
 * strings into Prisma GameStationType enum values. Deliberately rejects 'PS4', 'PS5', and 'PLAYSTATION'.
 */
export function toPrismaStationType(val: unknown): unknown {
  if (typeof val !== 'string') {
    return val;
  }
  const normalized = val.trim().replace(/\s+/g, ' ').toUpperCase();
  return INPUT_TO_PRISMA_MAP[normalized] ?? val;
}

/**
 * Converts a Prisma GameStationType value ('PLAYSTATION_4', 'PLAYSTATION_5') to its public API string.
 */
export function toPublicStationType(val: GameStationType | string): string {
  return PRISMA_TO_PUBLIC_MAP[val] ?? val;
}

/**
 * Checks whether a station type represents a console/VR device rather than PC.
 */
export function isConsoleStationType(val: GameStationType | string): boolean {
  const pub = toPublicStationType(val);
  return pub === 'PLAYSTATION 4' || pub === 'PLAYSTATION 5' || pub === 'XBOX' || pub === 'SWITCH' || pub === 'VR';
}

export function zodGameStationType() {
  return z.preprocess(toPrismaStationType, z.nativeEnum(GameStationType));
}

export function zodGameStationTypeOptional() {
  return z.preprocess(toPrismaStationType, z.nativeEnum(GameStationType).optional());
}

/**
 * Recursively transforms Prisma GameStationType enum keys/values ('PLAYSTATION_4' / 'PLAYSTATION_5')
 * into public API labels ('PLAYSTATION 4' / 'PLAYSTATION 5') across API response payloads.
 */
export function serializeStationTypesDeep<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value === 'string') {
    if (value === 'PLAYSTATION_4') return 'PLAYSTATION 4' as unknown as T;
    if (value === 'PLAYSTATION_5') return 'PLAYSTATION 5' as unknown as T;
    return value;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) {
      out.push(serializeStationTypesDeep(item, seen));
    }
    return out as unknown as T;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }

  const out: Record<string, unknown> = {};
  seen.set(value as object, out);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const mappedKey = k === 'PLAYSTATION_4' ? 'PLAYSTATION 4' : k === 'PLAYSTATION_5' ? 'PLAYSTATION 5' : k;
    out[mappedKey] = serializeStationTypesDeep(v, seen);
  }
  return out as T;
}

export const STATION_TYPE_AVAILABLE_VALUES = [
  { value: 'PC', label: 'PC' },
  { value: 'PLAYSTATION_4', label: 'PLAYSTATION 4' },
  { value: 'PLAYSTATION_5', label: 'PLAYSTATION 5' },
  { value: 'XBOX', label: 'XBOX' },
  { value: 'SWITCH', label: 'SWITCH' },
  { value: 'VR', label: 'VR' },
];
