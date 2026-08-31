import { BUCKET_ORDER, type Bucket, type WorkItem } from "./types.js";

const UNITS: Record<string, number> = {
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export function resolveSince(input: string | undefined, now = new Date()): Date {
  if (input) {
    const match = /^(\d+)\s*([hdw])$/.exec(input.trim().toLowerCase());
    if (!match) {
      throw new Error(`Could not read the time window "${input}". Try e.g. 1d, 2d or 12h.`);
    }
    const amount = Number(match[1]);
    return new Date(now.getTime() - amount * UNITS[match[2]]);
  }

  const daysBack = now.getDay() === 1 ? 3 : 1;
  return new Date(now.getTime() - daysBack * UNITS.d);
}

export function groupByBucket(items: WorkItem[]): [Bucket, WorkItem[]][] {
  return BUCKET_ORDER.map(
    (bucket) => [bucket, items.filter((item) => item.bucket === bucket)] as [Bucket, WorkItem[]],
  ).filter(([, group]) => group.length > 0);
}
