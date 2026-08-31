export interface WorkItem {
  source: "gitlab" | "jira";
  ref: string;
  title: string;
  url: string;
  bucket: Bucket;
  notes: string[];
}

export type Bucket = "shipped" | "in-progress" | "up-next";

export const BUCKET_ORDER: Bucket[] = ["shipped", "in-progress", "up-next"];

export const BUCKET_LABELS: Record<Bucket, string> = {
  shipped: "Shipped",
  "in-progress": "In progress",
  "up-next": "Up next",
};
