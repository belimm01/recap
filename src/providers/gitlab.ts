import type { GitLabConfig } from "../config.js";
import { getJson } from "../http.js";
import type { WorkItem } from "../types.js";

const PER_PAGE = 100;
const MAX_PAGES = 10;

interface GitLabMr {
  iid: number;
  title: string;
  web_url: string;
  state: "opened" | "closed" | "merged" | "locked";
  draft: boolean;
  has_conflicts: boolean;
  references?: { short?: string };
}

export async function fetchGitLab(config: GitLabConfig, since: Date): Promise<WorkItem[]> {
  const seen = new Map<string, WorkItem>();

  for (const scope of ["created_by_me", "assigned_to_me"] as const) {
    for (const mr of await getMergeRequests(config, scope, since)) {
      const item = toWorkItem(mr);
      if (item) seen.set(item.url, item);
    }
  }

  return [...seen.values()];
}

async function getMergeRequests(
  config: GitLabConfig,
  scope: string,
  since: Date,
): Promise<GitLabMr[]> {
  const all: GitLabMr[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      scope,
      updated_after: since.toISOString(),
      order_by: "updated_at",
      per_page: String(PER_PAGE),
      page: String(page),
    });

    const batch = await getJson<GitLabMr[]>(`${config.url}/api/v4/merge_requests?${params}`, {
      "PRIVATE-TOKEN": config.token,
    });
    const rows = Array.isArray(batch) ? batch : [];
    all.push(...rows);

    if (rows.length < PER_PAGE) break;
  }

  return all;
}

function toWorkItem(mr: GitLabMr): WorkItem | null {
  if (mr.state === "closed" || mr.state === "locked") return null;

  const notes: string[] = [];
  if (mr.draft) notes.push("draft");
  if (mr.has_conflicts) notes.push("has conflicts");

  return {
    source: "gitlab",
    ref: mr.references?.short ?? `!${mr.iid}`,
    title: mr.title.replace(/^Draft:\s*/i, ""),
    url: mr.web_url,
    bucket: mr.state === "merged" ? "shipped" : "in-progress",
    notes,
  };
}
