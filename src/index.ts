import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { config, verifyConfig } from './global/config.ts';
import { sendEmailReport } from './reporters/email.ts';
import { generateCalendarReport } from './sources/calendar.ts';
import { generateGitHubReport } from './sources/github.ts';
import { formatError } from './util/error.util.ts';

dayjs.extend(utc);
dayjs.extend(timezone);

try {
  console.log('Reading ENV');
  console.log(`App TZ: ${config.tz}`);
  verifyConfig();
  dayjs.tz.setDefault(config.tz);
} catch (e: unknown) {
  if (e != null && e instanceof Error) {
    // Exit with success code
    console.log(`[Error] ${e.message}`);
    process.exit(1);
  }
}

const now = dayjs();
const prevSunday = now.startOf('day').subtract(1, 'week');
const sunday = now.startOf('day');

console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Period: ${prevSunday.toISOString()} - ${sunday.toISOString()}`);

// Example: Process environment variables
const githubActions = config.github.actions;
if (githubActions) {
  console.log('Running in GitHub Actions');
  console.log(`Repository: ${config.github.repository}`);
  console.log(`Workflow: ${config.github.workflow}`);
} else {
  console.log('Running locally');
}

// Calendar Report
const calendarReport = await generateCalendarReport(
  config.calendar.credentials,
  prevSunday,
  sunday,
);

// Github Report
const githubReport = await generateGitHubReport(
  config.github.credentials,
  prevSunday,
  sunday,
);

// Merge reports into one
const mergedReport = {
  title: 'Weekly Activity Report',
  contents: new Map(calendarReport.contents),
  period: {
    start: prevSunday,
    end: sunday,
  },
};

// Merge GitHub report contents into calendar report
for (const [date, githubContents] of githubReport.contents) {
  const existingContents = mergedReport.contents.get(date) ?? [];
  mergedReport.contents.set(date, [...existingContents, ...githubContents]);
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
  console.log(
    `Period: ${mergedReport.period.start.format('YYYY-MM-DD')} to ${mergedReport.period.end.format('YYYY-MM-DD')}\n`,
  );

  // Sort dates chronologically
  const sortedDates = Array.from(mergedReport.contents.keys()).sort();

  for (const date of sortedDates) {
    const contents = mergedReport.contents.get(date);
    if (contents && contents.length > 0) {
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
