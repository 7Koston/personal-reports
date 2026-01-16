import dayjs from 'dayjs';
import { config, verifyConfig } from './global/config.ts';
import { sendEmailReport } from './reporters/email.ts';
import { generateCalendarReport } from './sources/calendar.ts';
import { formatError } from './util/error.util.ts';
import { replacer } from './util/json.util.ts';

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

// Github Report
/* const githubReport = await generateGitHubReport(
  config.github.credentials,
  weekStart,
  weekEnd,
);
console.log(JSON.stringify(githubReport, replacer)); */

// Calendar Report
const reports = [];
const calendarReport = await generateCalendarReport(
  config.calendar.credentials,
  weekStart,
  weekEnd,
);

console.log(JSON.stringify(calendarReport, replacer));
reports.push(calendarReport);

// Send Email Report
if (config.email.enabled) {
  try {
    await sendEmailReport(config.email, reports);
  } catch (error) {
    console.error(`[Error] Failed to send email: ${formatError(error)}`);
    process.exit(1);
  }
} else {
  console.log('Email reporting is disabled.');
}

// Exit with success code
process.exit(0);
