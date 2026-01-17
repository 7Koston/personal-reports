export interface GitHubCredentials {
  tokens: string[];
  username: string;
}

export interface GitHubConfig {
  actions: boolean; // Automatically grabbed from Github actions
  repository: string; // Automatically grabbed from Github actions
  workflow: string; // Automatically grabbed from Github actions
  credentials: GitHubCredentials;
}

export interface CalendarCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

export interface CalendarConfig {
  credentials: CalendarCredentials;
}

export interface EmailConfig {
  enabled: boolean;
  from: string;
  to: string[];
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
      tokens: process.env.GH_TOKENS?.split(';') ?? [],
      username: process.env.GH_USERNAME ?? '',
    },
  },
  calendar: {
    credentials: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? '',
      calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'primary',
    },
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    from: process.env.EMAIL_FROM ?? '',
    to: process.env.EMAIL_TO?.split(';') ?? [],
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
  if (config.github.credentials.tokens.length <= 0) {
    missing.push('GH_TOKENS');
  }
  if (config.github.credentials.username === '') {
    missing.push('GH_USERNAME');
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

  // Calendar validation
  if (config.calendar.credentials.clientId === '') {
    missing.push('GOOGLE_CLIENT_ID');
  }
  if (config.calendar.credentials.clientSecret === '') {
    missing.push('GOOGLE_CLIENT_SECRET');
  }
  if (config.calendar.credentials.refreshToken === '') {
    missing.push('GOOGLE_REFRESH_TOKEN');
  }
  if (config.calendar.credentials.calendarId === '') {
    missing.push('GOOGLE_CALENDAR_ID');
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return;
}
