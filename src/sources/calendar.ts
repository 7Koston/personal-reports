import axios from 'axios';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { promises as fs } from 'fs';
import path from 'path';
import type { CalendarCredentials } from '../global/config.ts';
import type {
  GoogleTokenResponse,
  ReportContent,
  ReportResult,
} from '../global/types.js';
import { formatError } from '../util/error.util.ts';
import { getDateRange, toIsoDate } from '../util/time.util.ts';

interface DayStatistics {
  count: number;
  totalMinutes: number;
  eventSummaries: string[];
}

type MeetingsByDate = Record<string, DayStatistics>; // ISO date string -> meeting statistics

interface CalendarEvents {
  items: CalendarEvent[];
}

interface CalendarEvent {
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

export async function generateCalendarReport(
  credentials: CalendarCredentials,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<ReportResult> {
  try {
    // Get access token using refresh token
    const tokenData = await refreshAccessToken(credentials);

    // Fetch all events in the date range
    const events = await fetchCalendarEvents(
      tokenData.access_token,
      credentials.calendarId,
      startDate,
      endDate,
    );

    // Save the new refresh token if provided
    if (tokenData.refresh_token != null && tokenData.refresh_token !== '') {
      await saveRefreshToken(tokenData.refresh_token);
    }

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

async function refreshAccessToken(
  credentials: CalendarCredentials,
): Promise<GoogleTokenResponse> {
  try {
    const response = await axios.post<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(`Failed to refresh access token: ${formatError(error)}`);
  }
}

async function saveRefreshToken(refreshToken: string): Promise<void> {
  try {
    const refreshTokenPath = path.join(process.cwd(), 'refresh_token');
    await fs.writeFile(refreshTokenPath, refreshToken, 'utf-8');
  } catch (error) {
    console.error('Failed to save refresh token:', formatError(error));
  }
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<CalendarEvent[]> {
  try {
    const response = await axios.get<CalendarEvents>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
    const startDateTime = event.start?.dateTime ?? event.start?.date ?? '';
    const endDateTime = event.end?.dateTime ?? event.end?.date ?? '';

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
    meetingsByDate[dateKey] ??= {
      count: 0,
      totalMinutes: 0,
      eventSummaries: [],
    };

    // Update statistics
    meetingsByDate[dateKey].count += 1;
    meetingsByDate[dateKey].totalMinutes += durationMinutes;

    // Add event summary if available
    if (event.summary != null) {
      meetingsByDate[dateKey].eventSummaries.push(event.summary);
    }
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
          title: `Meetings: ${statistics.count} (${durationText})`,
          items: statistics.eventSummaries.map((summary) => `• ${summary}`),
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
