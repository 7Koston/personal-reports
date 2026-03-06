import axios from 'axios';

/**
 * Formats an error for logging or display purposes.
 * Handles AxiosError with response data and generic Error objects.
 *
 * @param error - The error to format
 * @returns A formatted error message string
 */
export function formatError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data == null) {
      return error.message;
    }

    return JSON.stringify(error.response.data);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
