import dayjs, { type Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { config, verifyConfig } from './global/config.ts';
import type {
  ReportContent,
  ReportMode,
  ReportResult,
  ResolvedPeriod,
  RunOptions,
  TimeWindow,
} from './global/types.js';
import { sendEmailReport } from './reporters/email.ts';
import { generateCalendarReport } from './sources/calendar.ts';
import { generateGitHubReport } from './sources/github.ts';
import { formatError } from './util/error.util.ts';

const dayArgPattern = /^\d{4}-\d{2}-\d{2}$/;
const overtimeWindowBatchSize = 2;

dayjs.extend(utc);
dayjs.extend(timezone);

function printHelp(): void {
  console.log(
    'Usage: node src/index.ts [--mode standard|overtime] [--start YYYY-MM-DD] [--end YYYY-MM-DD]',
  );
  console.log('');
  console.log('Examples:');
  console.log('  node src/index.ts');
  console.log(
    '  node src/index.ts --mode overtime --start 2026-01-01 --end 2026-02-01',
  );
  console.log('');
  console.log('Notes:');
  console.log('  - default mode is standard (existing weekly behavior)');
  console.log('  - overtime mode requires both --start and --end');
  console.log(
    '  - overtime windows are Friday 23:00 to Monday 05:00 in configured TZ',
  );
}

function readOptionValue(
  flagName: string,
  currentArg: string,
  nextArg?: string,
): { value: string; consumeNext: boolean } {
  const inlinePrefix = `${flagName}=`;
  if (currentArg.startsWith(inlinePrefix)) {
    const value = currentArg.slice(inlinePrefix.length);
    if (value === '') {
      throw new Error(`Missing value for ${flagName}`);
    }
    return { value, consumeNext: false };
  }

  if (nextArg == null || nextArg.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }

  return {
    value: nextArg,
    consumeNext: true,
  };
}

function parseRunOptions(args: string[]): RunOptions {
  const options: RunOptions = {
    mode: 'standard',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--mode' || arg.startsWith('--mode=')) {
      const { value, consumeNext } = readOptionValue(
        '--mode',
        arg,
        args[index + 1],
      );
      if (consumeNext) {
        index += 1;
      }

      if (value === 'standard' || value === 'overtime') {
        options.mode = value;
      } else {
        throw new Error(`Invalid --mode value: ${value}`);
      }

      continue;
    }

    if (arg === '--start' || arg.startsWith('--start=')) {
      const { value, consumeNext } = readOptionValue(
        '--start',
        arg,
        args[index + 1],
      );
      if (consumeNext) {
        index += 1;
      }
      options.start = value;
      continue;
    }

    if (arg === '--end' || arg.startsWith('--end=')) {
      const { value, consumeNext } = readOptionValue(
        '--end',
        arg,
        args[index + 1],
      );
      if (consumeNext) {
        index += 1;
      }
      options.end = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseDateArg(value: string, flagName: '--start' | '--end'): Dayjs {
  if (!dayArgPattern.test(value)) {
    throw new Error(
      `${flagName} must be in YYYY-MM-DD format. Received: ${value}`,
    );
  }

  const parsed = dayjs.tz(`${value}T00:00:00`, config.tz);
  if (!parsed.isValid()) {
    throw new Error(`Invalid date for ${flagName}: ${value}`);
  }

  return parsed;
}

function resolvePeriod(now: Dayjs, options: RunOptions): ResolvedPeriod {
  const startInput = options.start;
  const endInput = options.end;
  const hasStart = startInput != null;
  const hasEnd = endInput != null;

  if (options.mode === 'overtime' && (!hasStart || !hasEnd)) {
    throw new Error(
      'Overtime mode requires both --start and --end (YYYY-MM-DD).',
    );
  }

  if (hasStart !== hasEnd) {
    throw new Error('Both --start and --end must be provided together.');
  }

  if (!hasStart || !hasEnd) {
    return {
      start: now.subtract(7, 'day').startOf('day'),
      end: now.endOf('day'),
    };
  }

  const start = parseDateArg(startInput, '--start').startOf('day');
  const end = parseDateArg(endInput, '--end').endOf('day');

  if (end.isBefore(start)) {
    throw new Error('--end must be the same day or later than --start.');
  }

  return { start, end };
}

function getOvertimeWindows(rangeStart: Dayjs, rangeEnd: Dayjs): TimeWindow[] {
  if (rangeEnd.isBefore(rangeStart)) {
    return [];
  }

  const windows: TimeWindow[] = [];
  let fridayCursor = rangeStart.startOf('day');

  // Move cursor to the Friday on or before rangeStart.
  while (fridayCursor.day() !== 5) {
    fridayCursor = fridayCursor.subtract(1, 'day');
  }

  while (
    fridayCursor.isBefore(rangeEnd) ||
    fridayCursor.isSame(rangeEnd, 'day')
  ) {
    const windowStart = fridayCursor
      .hour(23)
      .minute(0)
      .second(0)
      .millisecond(0);
    const windowEnd = fridayCursor
      .add(3, 'day')
      .hour(5)
      .minute(0)
      .second(0)
      .millisecond(0)
      .subtract(1, 'millisecond');

    if (!windowEnd.isBefore(rangeStart) && !windowStart.isAfter(rangeEnd)) {
      const start = windowStart.isAfter(rangeStart) ? windowStart : rangeStart;
      const end = windowEnd.isBefore(rangeEnd) ? windowEnd : rangeEnd;

      if (!end.isBefore(start)) {
        windows.push({ start, end });
      }
    }

    fridayCursor = fridayCursor.add(7, 'day');
  }

  return windows;
}

function mergeReportContents(
  target: Map<string, ReportContent[]>,
  source: Map<string, ReportContent[]>,
): void {
  for (const [date, sourceContents] of source) {
    const existingContents = target.get(date);
    if (existingContents == null) {
      const initialContents: ReportContent[] = [];
      for (const sourceContent of sourceContents) {
        initialContents.push(sourceContent);
      }
      target.set(date, initialContents);
      continue;
    }

    existingContents.push(...sourceContents);
  }
}

async function queryWindow(window: TimeWindow): Promise<{
  calendarReport: ReportResult;
  githubReport: ReportResult;
}> {
  const [calendarReport, githubReport] = await Promise.all([
    generateCalendarReport(
      config.calendar.credentials,
      window.start,
      window.end,
    ),
    generateGitHubReport(config.github.credentials, window.start, window.end),
  ]);

  return {
    calendarReport,
    githubReport,
  };
}

function createReportTitle(mode: ReportMode): string {
  if (mode === 'overtime') {
    return 'Overtime Activity Report';
  }

  return 'Weekly Activity Report';
}

async function main(): Promise<void> {
  const options = parseRunOptions(process.argv.slice(2));

  console.log('Reading ENV');
  console.log(`App TZ: ${config.tz}`);
  verifyConfig();
  dayjs.tz.setDefault(config.tz);

  const now = dayjs();
  const period = resolvePeriod(now, options);

  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Current directory: ${process.cwd()}`);
  console.log(`Period: ${period.start.toString()} - ${period.end.toString()}`);

  // Example: Process environment variables
  const githubActions = config.github.actions;
  if (githubActions) {
    console.log('Running in GitHub Actions');
    console.log(`Repository: ${config.github.repository}`);
    console.log(`Workflow: ${config.github.workflow}`);
  } else {
    console.log('Running locally');
  }

  const queryWindows: TimeWindow[] =
    options.mode === 'overtime'
      ? getOvertimeWindows(period.start, period.end)
      : [{ start: period.start, end: period.end }];

  if (options.mode === 'overtime') {
    console.log('Report mode: overtime');
    console.log(`Overtime windows in selected period: ${queryWindows.length}`);
  }

  const mergedContents = new Map<string, ReportContent[]>();
  const batchSize = options.mode === 'overtime' ? overtimeWindowBatchSize : 1;
  const totalBatches = Math.ceil(queryWindows.length / batchSize);

  for (let index = 0; index < queryWindows.length; index += batchSize) {
    const batch = queryWindows.slice(index, index + batchSize);
    const batchNumber = Math.floor(index / batchSize) + 1;

    if (options.mode === 'overtime' && totalBatches > 0) {
      console.log(`Processing overtime batch ${batchNumber}/${totalBatches}`);
    }

    const windowQueries: Array<
      Promise<{
        calendarReport: ReportResult;
        githubReport: ReportResult;
      }>
    > = [];

    for (const window of batch) {
      console.log(
        `  Query window ${window.start.format('YYYY-MM-DD HH:mm')} -> ${window.end.format('YYYY-MM-DD HH:mm')}`,
      );
      windowQueries.push(queryWindow(window));
    }

    const batchResults = await Promise.all(windowQueries);

    for (const windowResult of batchResults) {
      mergeReportContents(mergedContents, windowResult.calendarReport.contents);
      mergeReportContents(mergedContents, windowResult.githubReport.contents);
    }
  }

  const mergedReport: ReportResult = {
    title: createReportTitle(options.mode),
    contents: mergedContents,
    period: {
      start: period.start,
      end: period.end,
    },
  };

  if (options.mode === 'overtime') {
    mergedReport.contextNote =
      'Includes only overtime windows: Friday 23:00 to Monday 05:00.';
  }

  // Send Email Report
  if (config.email.enabled) {
    try {
      await sendEmailReport(config.email, mergedReport);
    } catch (error) {
      console.error(`[Error] Failed to send email: ${formatError(error)}`);
      process.exit(1);
    }
  } else {
    console.log('Email reporting is disabled. Printing report to console:\n');

    console.log(`=== ${mergedReport.title} ===`);
    if (mergedReport.contextNote != null) {
      console.log(mergedReport.contextNote);
    }
    console.log(
      `Period: ${mergedReport.period.start.format('YYYY-MM-DD')} to ${mergedReport.period.end.format('YYYY-MM-DD')}\n`,
    );

    // Sort dates chronologically
    const sortedDates = Array.from(mergedReport.contents.keys()).sort();

    for (const date of sortedDates) {
      const contents = mergedReport.contents.get(date);
      if (contents != null && contents.length > 0) {
        console.log(`\n📅 ${date}`);
        console.log('─'.repeat(50));

        for (const content of contents) {
          console.log(`\n${content.title}`);
          for (const item of content.items) {
            console.log(`  ${item}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(50));
  }

  // Exit with success code
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(`[Error] ${formatError(error)}`);
  process.exit(1);
});
