/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminJSPackages } from './load-adminjs';
import logger from '../../config/logger';

let isAdapterRegistered = false;

function normalizeAdminStationType(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const normalized = val.trim().replace(/\s+/g, ' ').toUpperCase();
  if (normalized === 'PLAYSTATION 4') return 'PLAYSTATION_4';
  if (normalized === 'PLAYSTATION 5') return 'PLAYSTATION_5';
  return val;
}

/**
 * Creates an enhanced Resource class that extends AdminJS Prisma Resource
 * to properly coerce data types (boolean, numbers, json/enum arrays)
 * sent via HTTP forms/multipart payloads into Prisma-compatible primitives,
 * preventing 'There was an error updating record' issues.
 */
export function createCustomPrismaResource(BaseResourceClass: any, ValidationErrorClass?: any) {
  return class CustomPrismaResource extends BaseResourceClass {
    prepareParams(params: any) {
      const prepared = super.prepareParams(params);
      const properties: any[] = typeof this.properties === 'function' ? this.properties() : [];

      for (const property of properties) {
        const key = typeof property.path === 'function' ? property.path() : property.name;
        const col = property.column || {};
        if (prepared[key] === undefined) {
          continue;
        }

        const propType = typeof property.type === 'function' ? property.type() : property.type;

        // 1. Coerce boolean values: form string 'true' / 'false' / '1' / '0' -> boolean
        if (propType === 'boolean' || col.type === 'Boolean') {
          if (typeof prepared[key] === 'string') {
            const trimmed = prepared[key].trim().toLowerCase();
            if (trimmed === 'true' || trimmed === '1') {
              prepared[key] = true;
            } else if (trimmed === 'false' || trimmed === '0' || trimmed === '') {
              prepared[key] = false;
            }
          }
        }

        // 2. Coerce numeric values: string -> number (Float, Int, Decimal)
        else if (
          propType === 'number' ||
          propType === 'float' ||
          ['Int', 'BigInt', 'Float', 'Decimal'].includes(col.type)
        ) {
          if (typeof prepared[key] === 'string' && prepared[key].trim() !== '') {
            const parsed = Number(prepared[key]);
            if (!Number.isNaN(parsed)) {
              prepared[key] = parsed;
            }
          }
        }

        // 3. Coerce array of enums or strings (e.g. supportedPlatforms)
        else if (col.isList) {
          let listVal: unknown[] | null = null;
          if (typeof prepared[key] === 'string') {
            try {
              const parsed = JSON.parse(prepared[key]);
              if (Array.isArray(parsed)) {
                listVal = parsed;
              } else {
                listVal = [prepared[key]];
              }
            } catch {
              if (prepared[key].includes(',')) {
                listVal = prepared[key].split(',').map((s: string) => s.trim()).filter(Boolean);
              } else if (prepared[key].trim() !== '') {
                listVal = [prepared[key].trim()];
              } else {
                listVal = [];
              }
            }
          } else if (Array.isArray(prepared[key])) {
            listVal = prepared[key];
          }
          if (listVal !== null) {
            prepared[key] = col.type === 'GameStationType'
              ? listVal.map((item) => normalizeAdminStationType(item))
              : listVal;
          }
        }

        // 4. Normalize single GameStationType enum values ('PLAYSTATION 4' -> 'PLAYSTATION_4', etc.)
        else if (col.type === 'GameStationType' && typeof prepared[key] === 'string') {
          prepared[key] = normalizeAdminStationType(prepared[key]);
        }
      }

      return prepared;
    }

    async update(pk: any, params: any = {}, context?: any) {
      try {
        return await super.update(pk, params, context);
      } catch (err: any) {
        logger.error({ err, pk, params, resource: this.id() }, 'AdminJS Prisma update error caught');
        if (ValidationErrorClass && !(err instanceof ValidationErrorClass)) {
          // If it's a Prisma validation or known error, wrap into ValidationError
          const message = err.message ? err.message.split('\n').filter(Boolean).pop() : 'Failed to update record';
          throw new ValidationErrorClass({}, { message });
        }
        throw err;
      }
    }

    async create(params: any = {}, context?: any) {
      try {
        return await super.create(params, context);
      } catch (err: any) {
        logger.error({ err, params, resource: this.id() }, 'AdminJS Prisma create error caught');
        if (ValidationErrorClass && !(err instanceof ValidationErrorClass)) {
          const message = err.message ? err.message.split('\n').filter(Boolean).pop() : 'Failed to create record';
          throw new ValidationErrorClass({}, { message });
        }
        throw err;
      }
    }
  };
}

export function registerPrismaAdapter(packages: AdminJSPackages): void {
  if (isAdapterRegistered) {
    return;
  }

  const { AdminJS, AdminJSPrisma } = packages;
  const ValidationErrorClass = (AdminJS as any).ValidationError;

  const CustomResource = createCustomPrismaResource(AdminJSPrisma.Resource, ValidationErrorClass);

  AdminJS.registerAdapter({
    Database: AdminJSPrisma.Database,
    Resource: CustomResource,
  });

  isAdapterRegistered = true;
}
