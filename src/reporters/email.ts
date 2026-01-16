import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailConfig } from '../global/config.ts';
import type { ReportResult } from '../global/types.js';
import { formatError } from '../util/error.util.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Creates a Gmail transporter using Google App Password authentication
 */
function createGmailTransporter(config: EmailConfig): Transporter {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.auth.user,
      pass: config.auth.pass, // The 16-character App Password
    },
  });
}

/**
 * Formats the report data into HTML email content
 */
async function formatReportAsHtml(reports: ReportResult[]): Promise<string> {
  // Read the HTML template
  const templatePath = join(__dirname, '..', 'html', 'email-template.html');
  const template = await readFile(templatePath, 'utf-8');

  // Build report sections
  const reportSections: string[] = [];
  for (const report of reports) {
    const startDateStr = report.period.start.format('MMMM D, YYYY');
    const endDateStr = report.period.end.format('MMMM D, YYYY');

    reportSections.push(
      `<div class="report-section">` +
        `<h2>${report.title}</h2>` +
        `<p class="period">Period: ${startDateStr} - ${endDateStr}</p>`,
    );

    // Iterate through each day's content
    const sortedDates = Array.from(report.contents.keys()).sort();
    for (const dateKey of sortedDates) {
      const contentArray = report.contents.get(dateKey);
      if (contentArray && contentArray.length > 0) {
        reportSections.push(`<div>` + `<h3 class="day">${dateKey}</h3>`);

        // Iterate through each content section for this day
        for (const content of contentArray) {
          reportSections.push(`<h4>${escapeHtml(content.title)}</h4>`);
          for (const item of content.items) {
            reportSections.push(`<p class="day-item">${escapeHtml(item)}</p>`);
          }
        }

        reportSections.push(`</div>`);
      }
    }

    reportSections.push(`</div>`);
  }

  // Replace placeholders in template
  return template
    .replace('{{REPORTS}}', reportSections.join(''))
    .replace('{{GENERATED_DATE}}', new Date().toLocaleString('en-US'));
}

/**
 * Formats the report data into plain text email content
 */
function formatReportAsText(reports: ReportResult[]): string {
  const textParts: string[] = [];

  textParts.push('='.repeat(60));
  textParts.push('ACTIVITY REPORT');
  textParts.push('='.repeat(60));
  textParts.push('');

  for (const report of reports) {
    const startDateStr = report.period.start.format('MMMM D, YYYY');
    const endDateStr = report.period.end.format('MMMM D, YYYY');

    textParts.push('-'.repeat(60));
    textParts.push(report.title);
    textParts.push(`Period: ${startDateStr} - ${endDateStr}`);
    textParts.push('-'.repeat(60));
    textParts.push('');

    // Iterate through each day's content
    const sortedDates = Array.from(report.contents.keys()).sort();
    for (const dateKey of sortedDates) {
      const contentArray = report.contents.get(dateKey);
      if (contentArray && contentArray.length > 0) {
        textParts.push(dateKey);
        textParts.push('');

        // Iterate through each content section for this day
        for (const content of contentArray) {
          textParts.push(content.title);
          for (const item of content.items) {
            textParts.push(item);
          }
          textParts.push('');
        }
      }
    }
  }

  textParts.push('='.repeat(60));
  textParts.push(`Generated on ${new Date().toLocaleString('en-US')}`);
  textParts.push('='.repeat(60));

  return textParts.join('\n');
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] ?? char);
}

/**
 * Sends an email report using Gmail App Password authentication
 */
export async function sendEmailReport(
  config: EmailConfig,
  reports: ReportResult[],
): Promise<void> {
  if (!config.enabled) {
    console.log('📧 Email sending is disabled. Skipping...');
    return;
  }

  if (reports.length === 0) {
    console.log('📧 No reports to send.');
    return;
  }

  try {
    const transporter = createGmailTransporter(config);

    // Generate email content
    const htmlContent = await formatReportAsHtml(reports);
    const textContent = formatReportAsText(reports);

    // Send email
    await transporter.sendMail({
      from: config.from,
      to: config.to.join(', '),
      subject: config.subject,
      text: textContent,
      html: htmlContent,
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Recipients: ${config.to.join(', ')}`);
  } catch (error) {
    throw new Error(`Failed to send email report: ${formatError(error)}`);
  }
}
