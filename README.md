# Personal Reports - TypeScript Scripts for GitHub Actions

A TypeScript-based automation tool that generates comprehensive weekly activity reports by aggregating data from GitHub and Google Calendar. The reports can be sent via email or displayed in the console, providing a unified view of your professional activities.

## Overview

This application automatically collects and summarizes your weekly work activities, including:

- **GitHub Activity**: Pull requests reviewed and opened, commits made, code changes (additions/deletions), and repositories contributed to
- **Meeting Schedule**: Calendar events with meeting counts and total duration per day
- **Automated Reporting**: Configurable email delivery or console output

Perfect for weekly status updates, time tracking, or maintaining a record of your professional contributions.

## Features

- **GitHub Integration**: Tracks pull requests reviewed, opened, commits, code changes, and contributed repositories
- **Google Calendar Integration**: Lists meetings with duration statistics (OAuth2 authentication for access to private event details)
- **Multi-Organization Support**: Use multiple GitHub tokens to aggregate data across different organizations
- **Email Reporting**: Sends formatted HTML and plain text reports via Gmail
- **Console Output**: Display reports directly in the terminal when email is disabled
- **Automatic Token Refresh**: Google OAuth tokens are automatically refreshed and saved

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
# Email Configuration
EMAIL_ENABLED=true
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=recipient1@example.com;recipient2@example.com

# GitHub Configuration
GH_TOKENS=token1;token2  # Semicolon-separated for multiple orgs
GH_USERNAME=your-github-username

# Google Calendar Configuration (OAuth2)
GOOGLE_APP_USER=your-email@gmail.com
GOOGLE_CALENDAR_ID=primary  # Or specific calendar ID
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_EMAIL_APP_PASSWORD=your-16-char-app-password
GOOGLE_REFRESH_TOKEN=your-refresh-token

# Timezone
TZ=America/New_York
```

### Google API Setup

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Calendar API

#### Step 2: Generate OAuth2 Credentials

To access your Google Calendar events (including private event details), you need to set up OAuth2 credentials:

1. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
2. If prompted, configure the OAuth consent screen first:
   - Select "External" user type
   - Fill in required fields (app name, user support email, developer contact)
   - Add the scope: `https://www.googleapis.com/auth/calendar.events.readonly`
3. Select "Web application" as application type
4. Add authorized redirect URIs:
   - `http://localhost:8080/oauth2callback` (for the automated token script)
   - `https://developers.google.com/oauthplayground` (optional, for manual token generation)
5. Click "Create" and download the credentials
6. Extract `client_id` and `client_secret` from the downloaded JSON file
7. Add these to your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

#### Step 3: Generate Refresh Token

This project includes an automated script to generate your Google OAuth2 refresh token:

```bash
pnpm local:google:token
```

**What this script does:**

1. Starts a local HTTP server on port 8080
2. Opens your default browser to Google's authorization page
3. After you grant permissions, captures the authorization code
4. Exchanges it for access and refresh tokens
5. Saves the refresh token to a `refresh_token` file in your project root
6. Displays the token value for you to add to your `.env` file

**Steps:**

1. Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your `.env` file
2. Run `pnpm local:google:token`
3. Sign in with your Google account in the browser window that opens
4. Grant the requested permissions (read-only access to calendar events)
5. The script will automatically save the refresh token and display it
6. Copy the token value and add it to your `.env` file as `GOOGLE_REFRESH_TOKEN`

**Troubleshooting:**

- If you get "No refresh token received", you may have already authorized the app. Revoke access at [Google Account Permissions](https://myaccount.google.com/permissions) and try again.
- Make sure port 8080 is not in use by another application
- If the browser doesn't open automatically, copy the URL from the console and paste it into your browser

**Alternative Method (Manual):**
You can also use the [OAuth2 Playground](https://developers.google.com/oauthplayground/):

1. Go to https://developers.google.com/oauthplayground/
2. Click on the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1, find "Calendar API v3" and select `https://www.googleapis.com/auth/calendar.events.readonly`
6. Click "Authorize APIs"
7. In Step 2, click "Exchange authorization code for tokens"
8. Copy the refresh token value

**Note:** The application automatically refreshes the access token when needed and saves the updated refresh token to a `refresh_token` file in the project root. In GitHub Actions, this file is automatically uploaded to repository secrets.

#### Gmail App Password

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to Security → 2-Step Verification
3. Scroll down to "App passwords"
4. Generate a new app password for "Mail" or "Other"
5. Use the 16-character password as `GOOGLE_EMAIL_APP_PASSWORD`

## Running Scripts

### Local Development

Run the report generator locally with environment variables from `.env` file:

```bash
pnpm local
```

Or directly using Node.js:

```bash
node --env-file=.env src/index.ts
```

### Generate Google Refresh Token

Generate or regenerate your Google OAuth2 refresh token:

```bash
pnpm local:google:token
```

This will open your browser for authorization and automatically save the token.

## GitHub Actions Setup

To run this application automatically on a weekly schedule using GitHub Actions:

### Step 1: Configure Repository Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add the following secrets:

| Secret Name                 | Description                                                             | Example Value                                   |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `EMAIL_ENABLED`             | Enable/disable email sending                                            | `true` or `false`                               |
| `EMAIL_FROM`                | Sender email address                                                    | `your-email@gmail.com`                          |
| `EMAIL_TO`                  | Recipient email addresses (semicolon-separated)                         | `recipient1@example.com;recipient2@example.com` |
| `GH_SECRETS_TOKEN`          | GitHub Fine-grained Personal Access Token with Secrets write permission | `github_pat_xxx`                                |
| `GH_TOKENS`                 | GitHub Personal Access Tokens (semicolon-separated)                     | `token1;token2`                                 |
| `GH_USERNAME`               | Your GitHub username                                                    | `your-username`                                 |
| `GOOGLE_APP_USER`           | Gmail account for sending emails                                        | `your-email@gmail.com`                          |
| `GOOGLE_CALENDAR_ID`        | Google Calendar ID                                                      | `primary` or `email@domain.com`                 |
| `GOOGLE_CLIENT_ID`          | Google OAuth2 Client ID                                                 | `xxx.apps.googleusercontent.com`                |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth2 Client Secret                                             | `GOCSPX-xxx`                                    |
| `GOOGLE_EMAIL_APP_PASSWORD` | Gmail App Password (16 characters)                                      | `xxxx xxxx xxxx xxxx`                           |
| `GOOGLE_REFRESH_TOKEN`      | Google OAuth2 Refresh Token                                             | `1//xxx`                                        |
| `TZ`                        | Your timezone                                                           | `America/New_York`                              |

**Note on `GH_SECRETS_TOKEN`:**
This token is required to automatically update the `GOOGLE_REFRESH_TOKEN` secret after each run. The Google OAuth refresh token may change when the access token is refreshed, so the workflow saves the new token back to repository secrets.

To create this token:

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Give it a descriptive name (e.g., "Weekly Reports Secret Updater")
4. Set expiration (recommended: 90 days or custom)
5. Under **Repository access**, select **Only select repositories** and choose your personal-reports repository
6. Under **Permissions** → **Repository permissions**, set:
   - **Secrets**: Read and write access
7. Click **Generate token** and copy it
8. Add it as the `GH_SECRETS_TOKEN` secret in your repository

### Step 2: Verify Workflow File

The repository includes a workflow file at [.github/workflows/runner.yml](.github/workflows/runner.yml) that:

- **Runs weekly** every Sunday at 5 AM UTC (`cron: "0 5 * * 7"`)
- **Can be triggered manually** via workflow dispatch
- **Runs on push/PR** to `main` branch (for testing)

The workflow:

1. Checks out the code
2. Sets up Node.js 24 and pnpm
3. Installs dependencies
4. Runs the report generator with environment variables from secrets
5. Automatically updates the `GOOGLE_REFRESH_TOKEN` secret if it changed

### Step 3: Test the Workflow

#### Option 1: Manual Trigger (Recommended for First Test)

1. Go to your repository on GitHub
2. Click on **Actions** tab
3. Select **Weekly runner** workflow from the left sidebar
4. Click **Run workflow** dropdown
5. Select the branch (usually `main`)
6. Click **Run workflow** button

#### Option 2: Push to Main Branch

The workflow will automatically run on any push to the `main` branch during testing.

#### Option 3: Wait for Scheduled Run

The workflow will automatically run every Sunday at 5 AM UTC based on the cron schedule.

### Step 4: Monitor Workflow Runs

1. Go to the **Actions** tab in your repository
2. Click on a workflow run to see its progress
3. Expand each step to view logs
4. Check for any errors in the execution

### Customizing the Schedule

To change the schedule, edit the cron expression in [.github/workflows/runner.yml](.github/workflows/runner.yml):

```yaml
on:
  schedule:
    - cron: '0 5 * * 7' # Every Sunday at 5 AM UTC
```

Common cron schedules:

- `"0 9 * * 1"` - Every Monday at 9 AM UTC
- `"0 17 * * 5"` - Every Friday at 5 PM UTC
- `"0 0 * * 0"` - Every Sunday at midnight UTC
- `"0 12 * * 1-5"` - Every weekday at noon UTC

Use [crontab.guru](https://crontab.guru/) to help create cron expressions.

### Troubleshooting

**Workflow fails with "Resource not accessible by integration":**

- Ensure `GH_SECRETS_TOKEN` is a fine-grained token with **Secrets** read and write permission
- The token must have access to the specific repository
- Verify the token hasn't expired

**No email received:**

- Check that `EMAIL_ENABLED` is set to `true`
- Verify `GOOGLE_APP_USER` and `GOOGLE_EMAIL_APP_PASSWORD` are correct
- Check workflow logs for email sending errors

**Calendar events not showing:**

- Verify `GOOGLE_REFRESH_TOKEN` is valid (run `pnpm local:google:token` locally to regenerate)
- Check that the Google Calendar API is enabled in your Google Cloud project
- Ensure the correct `GOOGLE_CALENDAR_ID` is set

**GitHub data is incomplete:**

- Verify `GH_TOKENS` have appropriate access to your repositories
- For organization repositories, ensure the token has the required permissions
- Multiple tokens can be used (separated by semicolons) to access different organizations

## Example Report Output

When running with `EMAIL_ENABLED=false`, the report is displayed in the console:

```
=== Weekly Activity Report ===
Period: 2026-01-12 to 2026-01-05

📅 2026-01-06
──────────────────────────────────────────────────

  Meetings: 3 (2h 30m)
    • Daily Standup
    • Sprint Planning
    • Code Review Session

  📊 GitHub Activity
    • Pull Requests Reviewed: 5
      - Fix authentication bug #234 (owner/api-service)
      - Add user dashboard feature #567 (owner/web-app)
      - Update dependencies #890 (owner/mobile-app)
      - Refactor database queries #123 (owner/backend)
      - Implement caching layer #456 (owner/infrastructure)

  📝 Pull Requests Opened
    • Implement new analytics feature #789 (owner/web-app)
    • Fix memory leak in worker process #321 (owner/backend)

  💻 Code Contributions
    • Additions: 847 lines
    • Deletions: 234 lines
    • Total changes: 1,081 lines

  🏢 Contributed to Repositories
    • owner/web-app
    • owner/backend
    • owner/infrastructure

📅 2026-01-07
──────────────────────────────────────────────────

  Meetings: 2 (1h 15m)
    • Team Sync
    • Architecture Discussion

  📊 GitHub Activity
    • Pull Requests Reviewed: 3
      - Performance improvements #445 (owner/api-service)
      - Add unit tests #667 (owner/web-app)
      - Update CI/CD pipeline #888 (owner/infrastructure)

  💻 Code Contributions
    • Additions: 423 lines
    • Deletions: 156 lines
    • Total changes: 579 lines

  🏢 Contributed to Repositories
    • owner/api-service
    • owner/web-app

📅 2026-01-08
──────────────────────────────────────────────────

  Meetings: 4 (3h 0m)
    • Client Demo
    • Retrospective Meeting
    • 1-on-1 with Manager
    • Technical Workshop

  📊 GitHub Activity
    • Pull Requests Reviewed: 2
      - Bug fix for login flow #999 (owner/web-app)
      - Database migration script #111 (owner/backend)

  📝 Pull Requests Opened
    • Add monitoring and alerting #222 (owner/infrastructure)

  💻 Code Contributions
    • Additions: 312 lines
    • Deletions: 89 lines
    • Total changes: 401 lines

  🏢 Contributed to Repositories
    • owner/web-app
    • owner/backend
    • owner/infrastructure

==================================================
```

**Note:** When `EMAIL_ENABLED=true`, the same information is sent as an HTML-formatted email instead of being printed to the console.

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

````
.
├── src/
│   ├── index.ts                    # Main entry point
│   ├── global/
│   │   ├── config.ts               # Configuration and environment variables
│   │   └── types.d.ts              # TypeScript type definitions
│   ├── sources/
│   │   ├── github.ts               # GitHub API integration
│   │   └── calendar.ts             # Google Calendar OAuth2 integration
│   ├── reporters/
│   │   └── email.ts                # Email report sender
│   ├── util/
│   │   ├── time.util.ts            # Date/time utilities
│   │   ├── json.util.ts            # JSON utilities
│   │   └── error.util.ts           # Error formatting utilities
│   └── html/
│       └── email-template.html     # HTML email template
├── scripts/
│   ├── clean.ts                    # Cleanup script
│   └── google-refresh-token.ts     # OAuth2 token generator
├── .github/
│   └── workflows/                  # GitHub Actions workflows
├── package.json
## How It Works

### Data Collection

The application collects data from two primary sources:

1. **GitHub API**
   - Searches for pull requests you reviewed and opened
   - Fetches commits you authored
   - Calculates code statistics (additions/deletions)
   - Identifies contributed repositories
   - Supports multiple tokens for cross-organization data aggregation

2. **Google Calendar API**
   - Uses OAuth2 authentication to access calendar events
   - Fetches events from the specified date range (including private event details)
   - Groups meetings by day
   - Calculates total meeting count and duration per day
   - Displays statistics for each day in the report
   - Automatically refreshes access tokens and saves updated refresh token to `refresh_token` file

### Report Generation

- Merges data from both sources by date
- Groups activities by day within the specified week
- Formats data for console output or HTML email
- Sends via Gmail or displays in terminal based on configuration

### API Authentication

This implementation uses:
- **OAuth2 with Refresh Tokens** for accessing Google Calendar (provides access to private event details)
- **Multiple GitHub Personal Access Tokens** for multi-organization support
- **Gmail App Password** for sending email reports via nodemailer

**Why OAuth2 for Calendar?**
- OAuth2 provides access to private calendar event details (event names, descriptions)
- API keys only work with public calendars
- Refresh tokens can be automatically renewed and saved for future use
- In GitHub Actions, the refresh token is automatically stored in repository secrets

## Adding New Data Sources

To extend the application with additional data sources (e.g., Jira, Linear, GitLab):

1. Create a new source file in [src/sources/](src/sources/) (e.g., `jira.ts`)
2. Implement a function that returns a `ReportResult` type
3. Import and call it in [src/index.ts](src/index.ts)
4. Add necessary configuration in [src/global/config.ts](src/global/config.ts)
5. Update environment variables in `.env` and `.env.example`
6. Update GitHub Actions workflow with new secrets (if using CI/CD)

Example structure:
```typescript
export async function generateJiraReport(
  credentials: JiraCredentials,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<ReportResult> {
  // Fetch data from Jira API
  // Organize by date
  // Return ReportResult
}
````

---

## About

❤️ This project was created with the assistance of Claude AI, which served as a tool to accelerate the development process - essentially functioning as a faster version of a keyboard. All architectural decisions, logic, and implementation details were directed by the [developer](https://github.com/7Koston).
