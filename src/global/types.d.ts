import type { Dayjs } from 'dayjs';

export type ReportMode = 'standard' | 'overtime';

export interface RunOptions {
  mode: ReportMode;
  start?: string;
  end?: string;
}

export interface ResolvedPeriod {
  start: Dayjs;
  end: Dayjs;
}

export interface TimeWindow {
  start: Dayjs;
  end: Dayjs;
}

export interface ReportContent {
  title: string;
  items: string[];
}

export interface ReportResult {
  title: string;
  contextNote?: string;
  contents: Map<string, ReportContent[]>; // YYYY-MM-DD : Array<ReportContent>
  period: {
    start: Dayjs;
    end: Dayjs;
  };
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}
