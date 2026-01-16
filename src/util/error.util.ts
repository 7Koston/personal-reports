import type { AxiosError } from 'axios';

/**
 * Formats an error for logging or display purposes.
 * Handles AxiosError with response data and generic Error objects.
 *
 * @param error - The error to format
 * @returns A formatted error message string
 */
export function formatError(error: unknown): string {
  if (error != null && typeof error === 'object' && 'response' in error) {
    // AxiosError type guard
    const axiosError = error as AxiosError;
    return JSON.stringify(axiosError.response?.data);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
