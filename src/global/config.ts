export interface GitHubCredentials {
  tokens: string[];
  username: string;
}

export interface GitHubConfig {
  actions: boolean;
  repository: string;
  workflow: string;
  credentials: GitHubCredentials;
}

export interface CalendarCredentials {
  apiKey: string;
  calendarId: string;
}

export interface CalendarConfig {
  credentials: CalendarCredentials;
}

export interface EmailConfig {
  enabled: boolean;
  from: string;
  to: string[];
  subject: string;
  auth: {
    user: string;
    pass: string;
  };
}

export interface AppConfig {
  tz: string;
  github: GitHubConfig;
  calendar: CalendarConfig;
  email: EmailConfig;
}

export const config: AppConfig = {
  tz: process.env.TZ ?? 'Etc/UTC',
  github: {
    actions: process.env.GITHUB_ACTIONS === 'true',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    workflow: process.env.GITHUB_WORKFLOW ?? '',
    credentials: {
      tokens: process.env.GITHUB_TOKENS?.split(';') ?? [],
      username: process.env.GITHUB_USERNAME ?? '',
    },
  },
  calendar: {
    credentials: {
      apiKey: process.env.GOOGLE_CALENDAR_API_KEY ?? '', // Use the same App Password from email
      calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'primary',
    },
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    from: process.env.EMAIL_FROM ?? '',
    to: process.env.EMAIL_TO?.split(';') ?? [],
    subject: process.env.EMAIL_SUBJECT ?? 'Weekly Activity Report',
    auth: {
      user: process.env.GOOGLE_APP_USER ?? '', // user email
      pass: process.env.GOOGLE_EMAIL_APP_PASSWORD ?? '', // The 16-character App Password
    },
  },
};

export function verifyConfig(): Error | undefined {
  const missing: string[] = [];

  if (config.tz === '') {
    missing.push('TZ');
  }
  if (config.github.repository === '') {
    missing.push('GITHUB_REPOSITORY');
  }
  if (config.github.workflow === '') {
    missing.push('GITHUB_WORKFLOW');
  }
  if (config.github.credentials.tokens.length <= 0) {
    missing.push('GITHUB_TOKENS');
  }
  if (config.github.credentials.username === '') {
    missing.push('GITHUB_USERNAME');
  }

  // Email validation - only if enabled
  if (config.email.enabled) {
    if (config.email.from === '') {
      missing.push('EMAIL_FROM');
    }
    if (config.email.to.length === 0) {
      missing.push('EMAIL_TO');
    }
    if (config.email.auth.user === '') {
      missing.push('GOOGLE_APP_USER');
    }
    if (config.email.auth.pass === '') {
      missing.push('GOOGLE_EMAIL_APP_PASSWORD');
    }
  }

  // Calendar validation - only if enabled
  if (config.calendar.credentials.apiKey === '') {
    missing.push('GOOGLE_CALENDAR_API_KEY');
  }
  if (config.calendar.credentials.calendarId === '') {
    missing.push('GOOGLE_CALENDAR_ID');
  }

  if (missing.length > 0) {
    return new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return;
}
