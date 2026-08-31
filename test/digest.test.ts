import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByBucket, resolveSince } from "../src/digest.js";
import type { Bucket, WorkItem } from "../src/types.js";

const DAY = 24 * 60 * 60 * 1000;
const item = (bucket: Bucket): WorkItem => ({
  source: "jira",
  ref: "X-1",
  title: "t",
  url: "u",
  bucket,
  notes: [],
});

test("resolveSince defaults to the last working day", () => {
  const monday = new Date(2026, 7, 31, 9);
  const tuesday = new Date(2026, 8, 1, 9);
  assert.equal(monday.getTime() - resolveSince(undefined, monday).getTime(), 3 * DAY);
  assert.equal(tuesday.getTime() - resolveSince(undefined, tuesday).getTime(), 1 * DAY);
});

test("resolveSince parses explicit windows", () => {
  const now = new Date(2026, 7, 31, 12);
  assert.equal(now.getTime() - resolveSince("2d", now).getTime(), 2 * DAY);
  assert.equal(now.getTime() - resolveSince("12h", now).getTime(), 12 * 60 * 60 * 1000);
  assert.equal(now.getTime() - resolveSince("1w", now).getTime(), 7 * DAY);
});

test("resolveSince rejects malformed windows", () => {
  assert.throws(() => resolveSince("banana"), /time window/);
});

test("groupByBucket orders buckets and drops empty ones", () => {
  const grouped = groupByBucket([item("up-next"), item("shipped"), item("in-progress")]);
  assert.deepEqual(
    grouped.map(([bucket]) => bucket),
    ["shipped", "in-progress", "up-next"],
  );

  const single = groupByBucket([item("up-next")]);
  assert.deepEqual(
    single.map(([bucket]) => bucket),
    ["up-next"],
  );
});
