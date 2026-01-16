import type { Dayjs } from 'dayjs';

export interface ReportContent {
  title: string;
  items: string[];
}

export interface ReportResult {
  title: string;
  contents: Map<string, ReportContent[]>; // YYYY-MM-DD : Array<ReportContent>
  period: {
    start: Dayjs;
    end: Dayjs;
  };
}
