
import { SECTION_DEFINITIONS, SectionConfig, FieldDefinition, FieldType } from './section-definitions';

export type { SectionConfig, FieldDefinition, FieldType };

export const sectionConfigs: Record<string, SectionConfig> = Object.fromEntries(
  Object.entries(SECTION_DEFINITIONS).map(([type, def]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { schema, renderer, ...config } = def;
    return [type, config];
  })
);
