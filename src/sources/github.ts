import axios, { type AxiosInstance } from 'axios';
import type { Dayjs } from 'dayjs';
import type { GitHubCredentials } from '../global/config.ts';
import type { ReportContent, ReportResult } from '../global/types.js';
import { formatError } from '../util/error.util.ts';
import { extractIsoDate, getDateRange, toIsoDate } from '../util/time.util.ts';

const commitStatsDetailRequestLimit = 25;

interface GitHubIssueSearchItem {
  title: string;
  number: number;
  repository_url: string;
  created_at: string;
}

interface GitHubCommitSearchItem {
  url: string;
  repository: {
    full_name: string;
  };
  commit: {
    committer: {
      date: string;
    };
  };
}

interface GitHubCommitDetail {
  stats?: {
    additions?: number;
    deletions?: number;
  };
}

interface GitHubPullRequestDetail {
  additions?: number;
  deletions?: number;
}

interface CommitFetchResult {
  commits: Commit[];
  truncatedStatsCount: number;
  rateLimitHit: boolean;
}

interface PullRequest {
  title: string;
  number: number;
  repository: string;
  date: string; // ISO date string
  additions?: number;
  deletions?: number;
}

interface Commit {
  additions: number;
  deletions: number;
  date: string; // ISO date string
  repository: string; // Repository full name
}

function formatDateTimeForGitHub(date: Dayjs): string {
  return date
    .toDate()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

function getHeaderStringValue(
  headers: unknown,
  key: string,
): string | undefined {
  if (!isRecord(headers)) {
    return;
  }

  const rawValue = headers[key];
  if (typeof rawValue === 'string') {
    return rawValue;
  }

  return;
}

function isRateLimitError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const statusCode = error.response?.status;
  if (statusCode === 429) {
    return true;
  }

  const remaining = getHeaderStringValue(
    error.response?.headers,
    'x-ratelimit-remaining',
  );
  if (remaining === '0') {
    return true;
  }

  if (!isRecord(error.response?.data)) {
    return false;
  }

  const message = error.response.data.message;
  if (typeof message !== 'string') {
    return false;
  }

  return message.toLowerCase().includes('rate limit');
}

function getRateLimitResetHint(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return '';
  }

  const resetHeader = getHeaderStringValue(
    error.response?.headers,
    'x-ratelimit-reset',
  );
  if (resetHeader == null) {
    return '';
  }

  const resetUnix = Number(resetHeader);
  if (!Number.isFinite(resetUnix)) {
    return '';
  }

  return ` (resets around ${new Date(resetUnix * 1000).toISOString()})`;
}

function getPullRequestKey(pullRequest: PullRequest): string {
  return `${pullRequest.repository}#${pullRequest.number}`;
}

export async function generateGitHubReport(
  credentials: GitHubCredentials,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<ReportResult> {
  try {
    // Use all tokens to gather data from different organizations
    const allOpenedPRs = new Map<string, PullRequest>();
    const allReviewedPRs = new Map<string, PullRequest>();
    const allCommits: Commit[] = [];
    let hasRateLimitError = false;
    let truncatedCommitStats = 0;

    // Iterate through all tokens to aggregate data
    for (const token of credentials.tokens) {
      const api = createGitHubClient(token);

      try {
        // Fetch PRs opened by the user
        const openedPRs = await fetchOpenedPRs(
          api,
          credentials.username,
          startDate,
          endDate,
        );
        for (const pr of openedPRs) {
          allOpenedPRs.set(getPullRequestKey(pr), pr);
        }

        // Fetch PRs reviewed by the user
        const reviewedPRs = await fetchReviewedPRs(
          api,
          credentials.username,
          startDate,
          endDate,
        );
        for (const pr of reviewedPRs) {
          allReviewedPRs.set(getPullRequestKey(pr), pr);
        }

        // Fetch commits by the user for code changes and projects.
        const commitResult = await fetchUserCommits(
          api,
          credentials.username,
          startDate,
          endDate,
        );
        allCommits.push(...commitResult.commits);
        truncatedCommitStats += commitResult.truncatedStatsCount;

        if (commitResult.rateLimitHit) {
          hasRateLimitError = true;
          console.warn(
            'GitHub API rate limit reached while fetching commit stats. Skipping remaining token requests for this period.',
          );
          break;
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          hasRateLimitError = true;
          console.warn(
            `GitHub API rate limit reached${getRateLimitResetHint(error)}. Skipping remaining token requests for this period.`,
          );
          break;
        }

        // Log error but continue with other tokens
        console.warn(`Failed to fetch data with token: ${formatError(error)}`);
      }
    }

    if (truncatedCommitStats > 0) {
      console.warn(
        `Skipped detailed GitHub stats for ${truncatedCommitStats} commits to avoid rate-limit exhaustion.`,
      );
    }

    if (hasRateLimitError) {
      console.warn(
        'GitHub activity may be partial because API rate limit was hit.',
      );
    }

    // Generate report string
    return formatReport(
      startDate,
      endDate,
      allOpenedPRs,
      allReviewedPRs,
      allCommits,
    );
  } catch (error) {
    throw new Error(`Failed to generate GitHub report: ${formatError(error)}`, {
      cause: error,
    });
  }
}

function createGitHubClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
}

async function fetchOpenedPRs(
  api: AxiosInstance,
  username: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<PullRequest[]> {
  const query = `is:pr author:${username} created:${formatDateTimeForGitHub(startDate)}..${formatDateTimeForGitHub(endDate)}`;
  const response = await api.get<{ items: GitHubIssueSearchItem[] }>(
    '/search/issues',
    {
      params: {
        q: query,
        per_page: 100,
      },
    },
  );

  const openedPullRequests: PullRequest[] = [];
  for (const item of response.data.items) {
    openedPullRequests.push({
      title: item.title,
      number: item.number,
      repository: item.repository_url.split('/').slice(-2).join('/'),
      date: extractIsoDate(item.created_at),
    });
  }

  for (const pullRequest of openedPullRequests) {
    const pullRequestApiPath = `/repos/${pullRequest.repository}/pulls/${pullRequest.number}`;

    try {
      const pullRequestDetail =
        await api.get<GitHubPullRequestDetail>(pullRequestApiPath);
      pullRequest.additions = pullRequestDetail.data.additions ?? 0;
      pullRequest.deletions = pullRequestDetail.data.deletions ?? 0;
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(
          `GitHub API rate limit reached while fetching pull request details${getRateLimitResetHint(error)}.`,
        );
        break;
      }

      console.warn(
        `Failed to fetch pull request details: ${formatError(error)}`,
      );
    }
  }

  return openedPullRequests;
}

async function fetchReviewedPRs(
  api: AxiosInstance,
  username: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<PullRequest[]> {
  const query = `is:pr reviewed-by:${username} created:${formatDateTimeForGitHub(startDate)}..${formatDateTimeForGitHub(endDate)}`;
  const response = await api.get<{ items: GitHubIssueSearchItem[] }>(
    '/search/issues',
    {
      params: {
        q: query,
        per_page: 100,
      },
    },
  );

  const reviewedPullRequests: PullRequest[] = [];
  for (const item of response.data.items) {
    reviewedPullRequests.push({
      title: item.title,
      number: item.number,
      date: extractIsoDate(item.created_at),
      repository: item.repository_url.split('/').slice(-2).join('/'),
    });
  }

  return reviewedPullRequests;
}

async function fetchUserCommits(
  api: AxiosInstance,
  username: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<CommitFetchResult> {
  const perPage = 100;

  // Search for commits by the user
  const query = `author:${username} committer-date:${formatDateTimeForGitHub(startDate)}..${formatDateTimeForGitHub(endDate)}`;

  const response = await api.get<{ items: GitHubCommitSearchItem[] }>(
    '/search/commits',
    {
      params: {
        q: query,
        per_page: perPage,
      },
      headers: {
        Accept: 'application/vnd.github+json',
      },
    },
  );

  const commits: Commit[] = [];
  const commitApiPaths: string[] = [];

  for (const item of response.data.items) {
    commits.push({
      additions: 0,
      deletions: 0,
      date: extractIsoDate(item.commit.committer.date),
      repository: item.repository.full_name,
    });
    commitApiPaths.push(item.url.replace('https://api.github.com', ''));
  }

  const statsToFetch = Math.min(commitStatsDetailRequestLimit, commits.length);
  let truncatedStatsCount = commits.length - statsToFetch;

  for (let index = 0; index < statsToFetch; index += 1) {
    const commitApiPath = commitApiPaths[index];
    const commitTarget = commits[index];

    if (commitApiPath == null || commitTarget == null) {
      continue;
    }

    try {
      const commitDetail = await api.get<GitHubCommitDetail>(commitApiPath);
      commitTarget.additions = commitDetail.data.stats?.additions ?? 0;
      commitTarget.deletions = commitDetail.data.stats?.deletions ?? 0;
    } catch (error) {
      truncatedStatsCount += 1;

      if (isRateLimitError(error)) {
        truncatedStatsCount += statsToFetch - (index + 1);
        console.warn(
          `GitHub API rate limit reached while fetching commit details${getRateLimitResetHint(error)}.`,
        );
        return {
          commits,
          truncatedStatsCount,
          rateLimitHit: true,
        };
      }

      console.warn(`Failed to fetch commit details: ${formatError(error)}`);
    }
  }

  return {
    commits,
    truncatedStatsCount,
    rateLimitHit: false,
  };
}

function formatReport(
  startDate: Dayjs,
  endDate: Dayjs,
  allOpenedPRs: Map<string, PullRequest>,
  allReviewedPRs: Map<string, PullRequest>,
  allCommits: Commit[],
): ReportResult {
  const contents = new Map<string, ReportContent[]>();
  const dates = getDateRange(startDate, endDate);

  // Create a content entry for each day in the period
  for (const date of dates) {
    const dateKey = toIsoDate(date);
    const contentArray: ReportContent[] = [];

    // Filter PRs reviewed on this specific date
    const reviewedPRsForDay: PullRequest[] = [];
    for (const pr of allReviewedPRs.values()) {
      if (pr.date === dateKey) {
        reviewedPRsForDay.push(pr);
      }
    }
    if (reviewedPRsForDay.length > 0) {
      const reviewedItems: string[] = [];
      for (const pr of reviewedPRsForDay) {
        reviewedItems.push(`• ${pr.repository}#${pr.number}: ${pr.title}`);
      }
      contentArray.push({
        title: 'Pull Requests Reviewed:',
        items: reviewedItems,
      });
    }

    // Filter PRs opened on this specific date
    const openedPRsForDay: PullRequest[] = [];
    for (const pr of allOpenedPRs.values()) {
      if (pr.date === dateKey) {
        openedPRsForDay.push(pr);
      }
    }
    if (openedPRsForDay.length > 0) {
      const openedItems: string[] = [];
      for (const pr of openedPRsForDay) {
        openedItems.push(`• ${pr.repository}#${pr.number}: ${pr.title}`);
      }
      contentArray.push({
        title: 'Pull Requests Opened:',
        items: openedItems,
      });
    }

    // Filter commits for this specific date
    const commitsForDay: Commit[] = [];
    for (const commit of allCommits) {
      if (commit.date === dateKey) {
        commitsForDay.push(commit);
      }
    }

    // Get unique projects from commits and PRs for this day
    const projectsForDay = new Set<string>();
    for (const commit of commitsForDay) {
      projectsForDay.add(commit.repository);
    }
    for (const pr of openedPRsForDay) {
      projectsForDay.add(pr.repository);
    }
    for (const pr of reviewedPRsForDay) {
      projectsForDay.add(pr.repository);
    }

    // Calculate changes for this specific day
    let commitAdditions = 0;
    let commitDeletions = 0;
    for (const commit of commitsForDay) {
      commitAdditions += commit.additions;
      commitDeletions += commit.deletions;
    }

    let openedPrAdditions = 0;
    let openedPrDeletions = 0;
    for (const pullRequest of openedPRsForDay) {
      if (pullRequest.additions == null || pullRequest.deletions == null) {
        continue;
      }

      openedPrAdditions += pullRequest.additions;
      openedPrDeletions += pullRequest.deletions;
    }

    let dailyAdditions = commitAdditions;
    let dailyDeletions = commitDeletions;
    const commitTotal = commitAdditions + commitDeletions;
    const openedPrTotal = openedPrAdditions + openedPrDeletions;
    const usingOpenedPrTotals = commitTotal === 0 && openedPrTotal > 0;
    if (usingOpenedPrTotals) {
      dailyAdditions = openedPrAdditions;
      dailyDeletions = openedPrDeletions;
    }

    const dailyTotal = dailyAdditions + dailyDeletions;

    // Projects Contributed To (only show if there's activity)
    if (projectsForDay.size > 0) {
      const projectItems: string[] = [];
      for (const project of projectsForDay) {
        projectItems.push(`• ${project}`);
      }
      contentArray.push({
        title: 'Projects Contributed To:',
        items: projectItems,
      });
    }

    // Total Changes
    if (dailyTotal > 0) {
      const changeItems = [
        `• Additions: +${dailyAdditions}`,
        `• Deletions: -${dailyDeletions}`,
        `• Total Changes: ${dailyTotal}`,
      ];

      if (usingOpenedPrTotals) {
        changeItems.push('• Source: Opened pull request stats');
      }

      contentArray.push({
        title: 'Total Code Changes:',
        items: changeItems,
      });
    }

    // Only add content if there are items for this day
    if (contentArray.length > 0) {
      contents.set(dateKey, contentArray);
    }
  }

  return {
    title: 'GitHub Weekly Activity Report',
    contents,
    period: {
      start: startDate,
      end: endDate,
    },
  };
}
