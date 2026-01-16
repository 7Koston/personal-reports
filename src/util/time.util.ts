import dayjs, { type Dayjs } from 'dayjs';

export function toIsoDate(date: Dayjs | Date | string | number): string {
  const _date = dayjs(date);
  return _date.format('YYYY-MM-DD');
}

/**
 * Get all dates between start and end (inclusive) as an array
 */
export function getDateRange(start: Dayjs, end: Dayjs): Dayjs[] {
  const dates: Dayjs[] = [];
  let current = start.startOf('day');
  const endDay = end.startOf('day');

  while (current.isBefore(endDay) || current.isSame(endDay)) {
    dates.push(current);
    current = current.add(1, 'day');
  }

  return dates;
}

/**
 * Format date for GitHub API queries (YYYY-MM-DD)
 */
export function formatDateForGitHub(date: Dayjs): string {
  return date.format('YYYY-MM-DD');
}

/**
 * Extract ISO date (YYYY-MM-DD) from a datetime string
 */
export function extractIsoDate(datetimeString: string): string {
  return datetimeString.split('T')[0];
}
