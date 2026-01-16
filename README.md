# Personal Reports - TypeScript Scripts for GitHub Actions

This project generates weekly activity reports from GitHub and Google Calendar, and sends them via email using Gmail.

## Features

- **GitHub Integration**: Tracks pull requests reviewed, opened, commits, and code changes
- **Google Calendar Integration**: Lists meetings from your calendar (excludes "busy", "vacation", and "out of office" entries)
- **Email Reporting**: Sends formatted HTML and plain text reports via Gmail

## Prerequisites

- Node.js >= 24.13.0
- Google App Password for Gmail and Calendar API access
- GitHub Personal Access Token(s)

## Installation

```bash
pnpm install
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Timezone
TZ=America/New_York

# GitHub Configuration
GITHUB_ACTIONS=false
GITHUB_REPOSITORY=owner/repo
GITHUB_WORKFLOW=Weekly Reports
APP_GITHUB_TOKENS=token1;token2  # Semicolon-separated for multiple orgs
APP_GITHUB_USERNAME=your-github-username

# Google Calendar Configuration
CALENDAR_ENABLED=true
GOOGLE_CALENDAR_ID=primary  # Or specific calendar ID
GOOGLE_APP_PASSWORD=your-16-char-app-password  # Used for both Calendar API and Gmail

# Email Configuration
EMAIL_ENABLED=true
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=recipient1@example.com;recipient2@example.com
EMAIL_SUBJECT=Weekly Activity Report
GOOGLE_APP_USER=your-email@gmail.com
```

### Getting a Google App Password

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification
3. Scroll down to "App passwords"
4. Generate a new app password for "Mail" or "Other"
5. Use the 16-character password as `GOOGLE_APP_PASSWORD`

## Running Scripts

Run locally with environment variables from `.env` file:

```bash
pnpm local
```

Scripts can be executed directly using Node.js:

```bash
node --env-file=.env src/index.ts
```

## Development

### Linting

```bash
pnpm lint        # Check for issues
pnpm lint:fix    # Fix issues automatically
```

### Formatting

```bash
pnpm format      # Format all files
```

### Cleaning

```bash
pnpm clean       # Remove dist folder
pnpm clean:full  # Remove dist, node_modules, and pnpm-lock.yaml
```

## Project Structure

```
.
├── src/
│   ├── index.ts           # Main entry point
│   ├── global/
│   │   ├── config.ts      # Configuration and environment variables
│   │   └── types.d.ts     # TypeScript type definitions
│   ├── sources/
│   │   ├── github.ts      # GitHub API integration
│   │   └── calendar.ts    # Google Calendar API integration
│   ├── reporters/
│   │   └── email.ts       # Email report sender
│   ├── util/
│   │   ├── time.util.ts   # Date/time utilities
│   │   └── json.util.ts   # JSON utilities
│   └── html/
│       └── email-template.html  # HTML email template
├── scripts/
│   └── clean.mjs          # Cleanup script
├── .github/
│   └── workflows/         # GitHub Actions workflows
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── README.md
```

## GitHub Actions Usage

Example workflow to run weekly reports:

```yaml
name: Weekly Reports
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9 AM
  workflow_dispatch: # Allow manual trigger

jobs:
  generate-reports:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: node --env-file=.env src/index.ts
        env:
          TZ: ${{ secrets.TZ }}
          APP_GITHUB_TOKENS: ${{ secrets.APP_GITHUB_TOKENS }}
          APP_GITHUB_USERNAME: ${{ secrets.APP_GITHUB_USERNAME }}
          CALENDAR_ENABLED: ${{ secrets.CALENDAR_ENABLED }}
          GOOGLE_CALENDAR_ID: ${{ secrets.GOOGLE_CALENDAR_ID }}
          GOOGLE_APP_PASSWORD: ${{ secrets.GOOGLE_APP_PASSWORD }}
          EMAIL_ENABLED: ${{ secrets.EMAIL_ENABLED }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          EMAIL_TO: ${{ secrets.EMAIL_TO }}
          GOOGLE_APP_USER: ${{ secrets.GOOGLE_APP_USER }}
```

## Calendar Integration

The Google Calendar integration:

- Fetches events from the specified date range
- Filters out events with titles containing "busy", "vacation", or "out of office" (case-insensitive)
- Groups meetings by day
- Lists meeting titles for each day in the report

### API Key vs OAuth

This implementation uses a Google App Password with the Calendar API for simplicity. The App Password provides access to both Gmail (for sending emails) and the Calendar API.

## Adding New Data Sources

1. Create a new source in `src/sources/` (e.g., `jira.ts`)
2. Implement a function that returns a `ReportResult`
3. Import and call it in `src/index.ts`
4. Add configuration in `src/global/config.ts`
5. Update the GitHub Actions workflow with new environment variables
