import axios, { type AxiosInstance } from 'axios';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { CalendarCredentials } from '../global/config.ts';
import type { ReportContent, ReportResult } from '../global/types.d.ts';
import { formatError } from '../util/error.util.ts';
import { getDateRange, toIsoDate } from '../util/time.util.ts';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

interface CalendarEventsResponse {
  items: CalendarEvent[];
}

interface DayStatistics {
  count: number;
  totalMinutes: number;
}

type MeetingsByDate = Record<string, DayStatistics>; // ISO date string -> meeting statistics

export async function generateCalendarReport(
  credentials: CalendarCredentials,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<ReportResult> {
  try {
    const api = createCalendarClient(credentials.apiKey);
    const calendarId = credentials.calendarId;

    // Fetch all events in the date range
    const events = await fetchCalendarEvents(
      api,
      calendarId,
      startDate,
      endDate,
    );

    // Filter and organize events by date
    const meetingsByDate = organizeEventsByDate(events, startDate, endDate);

    // Generate report
    return formatCalendarReport(startDate, endDate, meetingsByDate);
  } catch (error) {
    throw new Error(
      `Failed to generate Calendar report: ${formatError(error)}`,
    );
  }
}

function createCalendarClient(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://www.googleapis.com/calendar/v3',
    params: {
      key: apiKey,
    },
  });
}

async function fetchCalendarEvents(
  api: AxiosInstance,
  calendarId: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<CalendarEvent[]> {
  try {
    const response = await api.get<CalendarEventsResponse>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        params: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 2500,
        },
      },
    );

    return response.data.items ?? [];
  } catch (error) {
    throw new Error(`Failed to fetch calendar events: ${formatError(error)}`);
  }
}

function organizeEventsByDate(
  events: CalendarEvent[],
  _startDate: Dayjs,
  _endDate: Dayjs,
): MeetingsByDate {
  const meetingsByDate: MeetingsByDate = {};

  for (const event of events) {
    // Get the event start and end times
    const startDateTime = event.start.dateTime ?? event.start.date ?? '';
    const endDateTime = event.end.dateTime ?? event.end.date ?? '';

    if (startDateTime === '' || endDateTime === '') {
      continue;
    }

    // Extract ISO date (YYYY-MM-DD)
    const _startDateTime = dayjs(startDateTime);
    const _endDateTime = dayjs(endDateTime);
    const dateKey = toIsoDate(_startDateTime);

    // Calculate duration in minutes
    const durationMinutes = _endDateTime.diff(_startDateTime, 'minute');

    // Initialize statistics if not exists
    meetingsByDate[dateKey] ??= { count: 0, totalMinutes: 0 };

    // Update statistics
    meetingsByDate[dateKey].count += 1;
    meetingsByDate[dateKey].totalMinutes += durationMinutes;
  }

  return meetingsByDate;
}

function formatCalendarReport(
  startDate: Dayjs,
  endDate: Dayjs,
  meetingsByDate: MeetingsByDate,
): ReportResult {
  const contents = new Map<string, ReportContent[]>();
  const dates = getDateRange(startDate, endDate);

  // Create a content entry for each day in the period
  for (const date of dates) {
    const dateKey = toIsoDate(date);
    const statistics = meetingsByDate[dateKey];

    // Only add content if there are meetings for this day
    if (statistics !== undefined && statistics.count > 0) {
      const hours = Math.floor(statistics.totalMinutes / 60);
      const minutes = statistics.totalMinutes % 60;

      const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      contents.set(dateKey, [
        {
          title: 'Meetings:',
          items: [
            `• Total: ${statistics.count} meeting${statistics.count !== 1 ? 's' : ''}`,
            `• Duration: ${durationText}`,
          ],
        },
      ]);
    }
  }

  return {
    title: 'Calendar Weekly Activity Report',
    contents,
    period: {
      start: startDate,
      end: endDate,
    },
  };
}
