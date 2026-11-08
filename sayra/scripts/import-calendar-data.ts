import fs from 'fs';
import path from 'path';
import { iranCalendarRepo } from '../src/modules/iran-calendar/iran-calendar.repo';
import { CalendarImportYearData } from '../src/modules/iran-calendar/iran-calendar.types';
import logger from '../src/config/logger';

export async function importCalendarData(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  const data: CalendarImportYearData = JSON.parse(raw);

  if (!data.year || !Array.isArray(data.events)) {
    throw new Error('Invalid calendar year data format. Must have "year" and "events".');
  }

  const result = await iranCalendarRepo.importYearData(data);
  logger.info(`Successfully imported calendar data for year ${data.year} (${data.events.length} events).`);
  return result;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetFile = args[0] || path.join(__dirname, '../src/modules/iran-calendar/data/calendar-1405.json');

  importCalendarData(targetFile)
    .then(() => {
      logger.info('Import completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Import failed:');
      process.exit(1);
    });
}
