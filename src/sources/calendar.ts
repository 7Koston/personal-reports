import axios, { type AxiosInstance } from 'axios';
import type { Dayjs } from 'dayjs';
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

type MeetingsByDate = Record<string, string[]>; // ISO date string -> array of meeting titles

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
  const excludedTitles = ['busy', 'vacation', 'out of office'];

  for (const event of events) {
    // Skip events without a summary
    if (!event.summary) {
      continue;
    }

    // Filter out excluded meeting titles (case-insensitive)
    const summaryLower = event.summary.toLowerCase();
    if (excludedTitles.some((excluded) => summaryLower.includes(excluded))) {
      continue;
    }

    // Get the event date
    const eventDate = event.start.dateTime ?? event.start.date ?? '';
    if (eventDate === '') {
      continue;
    }

    // Extract ISO date (YYYY-MM-DD)
    const dateKey = eventDate.split('T')[0];

    // Initialize array if not exists
    meetingsByDate[dateKey] ??= [];

    // Add meeting title
    meetingsByDate[dateKey].push(event.summary);
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
    const meetings = meetingsByDate[dateKey];

    // Only add content if there are meetings for this day
    if (meetings !== undefined && meetings.length > 0) {
      const meetingItems = meetings.map((meeting) => `• ${meeting}`);

      contents.set(dateKey, [
        {
          title: 'Meetings:',
          items: meetingItems,
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
