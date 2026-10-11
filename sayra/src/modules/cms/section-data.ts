import { PageSectionType } from '@prisma/client';
import { ZodError } from 'zod';

import { pageSectionSchemaByType } from './page-section-registry';

type SectionParseContext = {
  pageId?: string;
  sectionId?: string;
  type: PageSectionType | string;
};

type SectionDataParseInput = SectionParseContext & {
  dataJson?: string | null;
};

const isKnownSectionType = (type: string): type is PageSectionType =>
  (Object.values(PageSectionType) as string[]).includes(type);

const logSectionDataError = (
  message: string,
  context: SectionParseContext,
  error?: unknown,
) => {
  const payload = {
    pageId: context.pageId ?? 'unknown',
    sectionId: context.sectionId ?? 'unknown',
    type: context.type ?? 'unknown',
    error,
  };
  console.warn(`[cms] ${message}`, payload);
};

export const parseSectionDataJson = ({
  type,
  dataJson,
  pageId,
  sectionId,
}: SectionDataParseInput): Record<string, unknown> | null => {
  if (!dataJson) {
    logSectionDataError('Missing section data JSON.', { pageId, sectionId, type });
    return null;
  }

  const typeStr = String(type);
  if (!isKnownSectionType(typeStr)) {
    logSectionDataError('Unsupported section type.', { pageId, sectionId, type: typeStr });
    return null;
  }
  const sectionType = typeStr as PageSectionType;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(dataJson);
  } catch (error) {
    logSectionDataError('Section data JSON parse failed.', { pageId, sectionId, type }, error);
    return null;
  }

  const schema = pageSectionSchemaByType(sectionType);
  if (!schema) {
    logSectionDataError('Missing schema for section type.', { pageId, sectionId, type });
    return null;
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    logSectionDataError(
      'Section data validation failed.',
      { pageId, sectionId, type },
      result.error instanceof ZodError ? result.error.format() : result.error,
    );
    return null;
  }

  return result.data as Record<string, unknown>;
};
