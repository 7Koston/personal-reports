import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { config, verifyConfig } from './global/config.ts';
import { sendEmailReport } from './reporters/email.ts';
import { generateCalendarReport } from './sources/calendar.ts';
import { generateGitHubReport } from './sources/github.ts';
import { formatError } from './util/error.util.ts';
import { replacer } from './util/json.util.ts';

dayjs.extend(utc);
dayjs.extend(timezone);

try {
  console.log(config);
  verifyConfig();
} catch (e: unknown) {
  if (e != null && e instanceof Error) {
    // Exit with success code
    console.log(`[Error] ${e.message}`);
    process.exit(1);
  }
}

const now = dayjs();
const weekStart = now.startOf('week');
const weekEnd = now.endOf('week');

console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Current directory: ${process.cwd()}`);

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
  weekStart,
  weekEnd,
);

// Github Report
const githubReport = await generateGitHubReport(
  config.github.credentials,
  weekStart,
  weekEnd,
);

// Merge reports into one
const mergedReport = {
  title: 'Weekly Activity Report',
  contents: new Map(calendarReport.contents),
  period: {
    start: weekStart,
    end: weekEnd,
  },
};

// Merge GitHub report contents into calendar report
for (const [date, githubContents] of githubReport.contents) {
  const existingContents = mergedReport.contents.get(date) ?? [];
  mergedReport.contents.set(date, [...existingContents, ...githubContents]);
}

console.log(JSON.stringify(mergedReport, replacer));

// Send Email Report
if (config.email.enabled) {
  try {
    await sendEmailReport(config.email, mergedReport);
  } catch (error) {
    console.error(`[Error] Failed to send email: ${formatError(error)}`);
    process.exit(1);
  }
} else {
  console.log('Email reporting is disabled.');
}

// Exit with success code
process.exit(0);
