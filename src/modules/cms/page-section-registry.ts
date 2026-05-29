/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { PageSectionType } from '@prisma/client';
import { sectionConfigs } from './section-config';
import { SECTION_DEFINITIONS, escapeHtml } from './section-definitions';

export { escapeHtml };

export type PageSectionInput = {
  id?: string | null;
  type: PageSectionType | string;
  dataJson?: string | null;
  isEnabled?: boolean | null;
  sortOrder?: number | null;
};

export const pageSectionSchemas = Object.fromEntries(
  Object.entries(SECTION_DEFINITIONS).map(([type, def]) => [type, def.schema])
) as Record<PageSectionType, z.ZodTypeAny>;

export const sectionRenderers = Object.fromEntries(
  Object.entries(SECTION_DEFINITIONS).map(([type, def]) => [type, def.renderer]),
) as Record<PageSectionType, (data: Record<string, any>) => string>;

export const pageSectionSchemaByType = (type: PageSectionType) => pageSectionSchemas[type];

export const validateSectionData = (type: PageSectionType, dataJson: string) => {
  const schema = pageSectionSchemaByType(type);
  if (!schema) {
    throw new Error(`Unsupported page section type: ${type}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(dataJson);
  } catch (error) {
    throw new Error('Section data is not valid JSON.');
  }

  return schema.parse(parsedJson);
};

export const serializeSectionRegistryForEditor = () => {
  return JSON.stringify(sectionConfigs, null, 2);
};
