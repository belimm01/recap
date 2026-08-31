import { BUCKET_ORDER, type Bucket, type WorkItem } from "./types.js";

const UNITS: Record<string, number> = {
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Work out the start of the reporting window.
 *
 * With no explicit value we look back to the last working day: one day
 * normally, three on a Monday so the weekend doesn't swallow Friday's work.
 * An explicit value like "2d" or "12h" overrides that.
 */
export function resolveSince(input: string | undefined, now = new Date()): Date {
  if (input) {
    const match = /^(\d+)\s*([hdw])$/.exec(input.trim().toLowerCase());
    if (!match) {
      throw new Error(`Could not read the time window "${input}". Try e.g. 1d, 2d or 12h.`);
    }
    const amount = Number(match[1]);
    return new Date(now.getTime() - amount * UNITS[match[2]]);
  }

  const daysBack = now.getDay() === 1 ? 3 : 1; // Monday reaches back to Friday
  return new Date(now.getTime() - daysBack * UNITS.d);
}

/** Group items into the standup buckets, dropping empty ones. */
export function groupByBucket(items: WorkItem[]): [Bucket, WorkItem[]][] {
  return BUCKET_ORDER.map(
    (bucket) => [bucket, items.filter((item) => item.bucket === bucket)] as [Bucket, WorkItem[]],
  ).filter(([, group]) => group.length > 0);
}
