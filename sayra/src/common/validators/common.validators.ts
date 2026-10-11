
import { z } from 'zod';

const CUID_MESSAGE = 'Invalid CUID';

export const idParamSchema = (paramName: string) =>
  z.object({
    params: z.object({
      [paramName]: z.string().cuid(CUID_MESSAGE),
    }),
  });
