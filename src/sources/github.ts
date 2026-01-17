import axios, { type AxiosInstance } from 'axios';
import type { Dayjs } from 'dayjs';
import type { GitHubCredentials } from '../global/config.ts';
import type { ReportContent, ReportResult } from '../global/types.js';
import { formatError } from '../util/error.util.ts';
import {
  extractIsoDate,
  formatDateForGitHub,
  getDateRange,
  toIsoDate,
} from '../util/time.util.ts';

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

interface PullRequest {
  title: string;
  number: number;
  repository: string;
  date: string; // ISO date string
}

interface Commit {
  additions: number;
  deletions: number;
  date: string; // ISO date string
  repository: string; // Repository full name
}

interface GitHubReportData {
  reviewedPRs: string[];
  openedPRs: string[];
  contributedProjects: string[];
  totalChanges: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export async function generateGitHubReport(
  credentials: GitHubCredentials,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<ReportResult> {
  const reportData: GitHubReportData = {
    reviewedPRs: [],
    openedPRs: [],
    contributedProjects: [],
    totalChanges: {
      additions: 0,
      deletions: 0,
      total: 0,
    },
  };

  try {
    // Use all tokens to gather data from different organizations
    const allOpenedPRs = new Map<number, PullRequest>();
    const allReviewedPRs = new Map<number, PullRequest>();
    const allCommits: Commit[] = [];
    const allProjects = new Set<string>();

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
          allOpenedPRs.set(pr.number, pr);
        }

        // Fetch PRs reviewed by the user
        const reviewedPRs = await fetchReviewedPRs(
          api,
          credentials.username,
          startDate,
          endDate,
        );
        for (const pr of reviewedPRs) {
          allReviewedPRs.set(pr.number, pr);
        }

        // Fetch commits by the user to get changes and projects
        const commits = await fetchUserCommits(
          api,
          credentials.username,
          startDate,
          endDate,
        );
        allCommits.push(...commits);

        // Get projects from commits
        const commitProjects = await fetchCommitProjects(
          api,
          credentials.username,
          startDate,
          endDate,
        );
        for (const project of commitProjects) {
          allProjects.add(project);
        }
      } catch (error) {
        // Log error but continue with other tokens
        console.warn(`Failed to fetch data with token: ${formatError(error)}`);
      }
    }

    // Convert aggregated data to report format
    reportData.openedPRs = [];
    for (const pr of allOpenedPRs.values()) {
      reportData.openedPRs.push(`${pr.repository}#${pr.number}: ${pr.title}`);
    }
    reportData.reviewedPRs = [];
    for (const pr of allReviewedPRs.values()) {
      reportData.reviewedPRs.push(`${pr.repository}#${pr.number}: ${pr.title}`);
    }

    // Calculate total changes
    for (const commit of allCommits) {
      reportData.totalChanges.additions += commit.additions;
      reportData.totalChanges.deletions += commit.deletions;
    }
    reportData.totalChanges.total =
      reportData.totalChanges.additions + reportData.totalChanges.deletions;

    // Add unique projects from PRs to the set
    for (const pr of allOpenedPRs.values()) {
      allProjects.add(pr.repository);
    }
    for (const pr of allReviewedPRs.values()) {
      allProjects.add(pr.repository);
    }

    reportData.contributedProjects = Array.from(allProjects);

    // Generate report string
    return formatReport(
      startDate,
      endDate,
      allOpenedPRs,
      allReviewedPRs,
      allCommits,
    );
  } catch (error) {
    throw new Error(`Failed to generate GitHub report: ${formatError(error)}`);
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
  const query = `is:pr author:${username} created:${formatDateForGitHub(startDate)}..${formatDateForGitHub(endDate)}`;
  const response = await api.get<{ items: GitHubIssueSearchItem[] }>(
    '/search/issues',
    {
      params: {
        q: query,
        per_page: 100,
      },
    },
  );

  return response.data.items.map((item) => ({
    title: item.title,
    number: item.number,
    repository: item.repository_url.split('/').slice(-2).join('/'),
    date: extractIsoDate(item.created_at),
  }));
}

async function fetchReviewedPRs(
  api: AxiosInstance,
  username: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<PullRequest[]> {
  const query = `is:pr reviewed-by:${username} created:${formatDateForGitHub(startDate)}..${formatDateForGitHub(endDate)}`;
  const response = await api.get<{ items: GitHubIssueSearchItem[] }>(
    '/search/issues',
    {
      params: {
        q: query,
        per_page: 100,
      },
    },
  );

  return response.data.items.map((item) => ({
    title: item.title,
    number: item.number,
    date: extractIsoDate(item.created_at),
    repository: item.repository_url.split('/').slice(-2).join('/'),
  }));
}

async function fetchUserCommits(
  api: AxiosInstance,
  username: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<Commit[]> {
  const commits: Commit[] = [];
  const page = 1;
  const perPage = 100;

  // Search for commits by the user
  const query = `author:${username} committer-date:${formatDateForGitHub(startDate)}..${formatDateForGitHub(endDate)}`;

  try {
    const response = await api.get<{ items: GitHubCommitSearchItem[] }>(
      '/search/commits',
      {
        params: {
          q: query,
          per_page: perPage,
          page: page,
        },
        headers: {
          Accept: 'application/vnd.github+json',
        },
      },
    );

    for (const commit of response.data.items) {
      try {
        // Fetch detailed commit info to get stats
        const commitDetail = await api.get<GitHubCommitDetail>(
          commit.url.replace('https://api.github.com', ''),
        );
        commits.push({
          additions: commitDetail.data.stats?.additions ?? 0,
          deletions: commitDetail.data.stats?.deletions ?? 0,
          date: extractIsoDate(commit.commit.committer.date),
          repository: commit.repository.full_name,
        });
      } catch (error) {
        // Skip commits that can't be fetched
        console.warn(`Failed to fetch commit details: ${formatError(error)}`);
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch commits: ${formatError(error)}`);
  }

  return commits;
}

async function fetchCommitProjects(
  api: AxiosInstance,
  username: string,
  startDate: Dayjs,
  endDate: Dayjs,
): Promise<string[]> {
  const projects = new Set<string>();
  const query = `author:${username} committer-date:${formatDateForGitHub(startDate)}..${formatDateForGitHub(endDate)}`;

  try {
    const response = await api.get<{ items: GitHubCommitSearchItem[] }>(
      '/search/commits',
      {
        params: {
          q: query,
          per_page: 100,
        },
        headers: {
          Accept: 'application/vnd.github+json',
        },
      },
    );

    for (const commit of response.data.items) {
      if (commit.repository?.full_name) {
        projects.add(commit.repository.full_name);
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch commit projects: ${formatError(error)}`);
  }

  return Array.from(projects);
}

function formatReport(
  startDate: Dayjs,
  endDate: Dayjs,
  allOpenedPRs: Map<number, PullRequest>,
  allReviewedPRs: Map<number, PullRequest>,
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
    let dailyAdditions = 0;
    let dailyDeletions = 0;
    for (const commit of commitsForDay) {
      dailyAdditions += commit.additions;
      dailyDeletions += commit.deletions;
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
      contentArray.push({
        title: 'Total Code Changes:',
        items: [
          `• Additions: +${dailyAdditions}`,
          `• Deletions: -${dailyDeletions}`,
          `• Total Changes: ${dailyTotal}`,
        ],
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
