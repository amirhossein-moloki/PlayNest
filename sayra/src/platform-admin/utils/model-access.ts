/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from '../../config/prisma';

export interface PrismaModelResourceTarget {
  model: any; // DMMF Model structure required by @adminjs/prisma
  client: PrismaClient;
}

/**
 * Safely looks up a model definition from Prisma.dmmf and pairs it with the PrismaClient instance.
 */
export function getPrismaModelTarget(
  modelName: string,
  client: PrismaClient = defaultPrismaClient
): PrismaModelResourceTarget {
  const model = Prisma.dmmf.datamodel.models.find(
    (m) => m.name.toLowerCase() === modelName.toLowerCase()
  );

  if (!model) {
    throw new Error(`Prisma model '${modelName}' not found in DMMF schema.`);
  }

  return {
    model,
    client,
  };
}
