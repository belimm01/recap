import type { JiraConfig } from "../config.js";
import { getJson } from "../http.js";
import type { Bucket, WorkItem } from "../types.js";

const PAGE_SIZE = 50;
const MAX_ISSUES = 200; // don't drown a standup in a huge backlog

interface JiraSearchResponse {
  issues?: JiraIssue[];
  total?: number;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
  };
}

/**
 * Fetch issues assigned to you that changed since `since`. Jira's status
 * categories (new / indeterminate / done) map cleanly onto our buckets.
 */
export async function fetchJira(config: JiraConfig, since: Date): Promise<WorkItem[]> {
  const jql = `assignee = currentUser() AND updated >= "${asJiraDate(since)}" ORDER BY updated DESC`;
  const issues: JiraIssue[] = [];

  for (let startAt = 0; startAt < MAX_ISSUES; startAt += PAGE_SIZE) {
    const params = new URLSearchParams({
      jql,
      fields: "summary,status",
      startAt: String(startAt),
      maxResults: String(PAGE_SIZE),
    });

    const page = await getJson<JiraSearchResponse>(`${config.url}/rest/api/2/search?${params}`, {
      Authorization: basicAuth(config.user, config.token),
      Accept: "application/json",
    });

    const batch = page.issues ?? [];
    issues.push(...batch);

    if (batch.length < PAGE_SIZE || startAt + PAGE_SIZE >= (page.total ?? 0)) break;
  }

  return issues.map((issue) => toWorkItem(issue, config.url));
}

function toWorkItem(issue: JiraIssue, baseUrl: string): WorkItem {
  const category = issue.fields.status.statusCategory.key;
  return {
    source: "jira",
    ref: issue.key,
    title: issue.fields.summary,
    url: `${baseUrl}/browse/${issue.key}`,
    bucket: bucketFor(category),
    // The concrete status ("In Review", "Blocked") is more useful than the
    // category, so keep it around as a note.
    notes: [issue.fields.status.name],
  };
}

function bucketFor(category: string): Bucket {
  if (category === "done") return "shipped";
  if (category === "indeterminate") return "in-progress";
  return "up-next";
}

function asJiraDate(date: Date): string {
  return date.toISOString().slice(0, 10); // yyyy-mm-dd
}

function basicAuth(user: string, token: string): string {
  return `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
}
