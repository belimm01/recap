/** A single thing you worked on, normalized across GitLab and Jira. */
export interface WorkItem {
  source: "gitlab" | "jira";
  /** Human reference, e.g. "!42" for an MR or "ABC-123" for an issue. */
  ref: string;
  title: string;
  url: string;
  bucket: Bucket;
  /** Short flags worth surfacing: "draft", "pipeline failed", ... */
  notes: string[];
}

/**
 * Where an item lands in the standup. The three questions everyone answers:
 * what did I finish, what am I on, what's next.
 */
export type Bucket = "shipped" | "in-progress" | "up-next";

export const BUCKET_ORDER: Bucket[] = ["shipped", "in-progress", "up-next"];

export const BUCKET_LABELS: Record<Bucket, string> = {
  shipped: "Shipped",
  "in-progress": "In progress",
  "up-next": "Up next",
};
