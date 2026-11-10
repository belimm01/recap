import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type TestContext, test } from "node:test";
import { fetchGitLab } from "../src/providers/gitlab.js";
import { fetchJira } from "../src/providers/jira.js";
import { renderMarkdown } from "../src/render.js";
import type { WorkItem } from "../src/types.js";

const fixtures = JSON.parse(
  readFileSync(new URL("./fixtures/providers.json", import.meta.url), "utf8"),
);
const since = new Date("2026-08-28T14:30:00.000Z");
const gitlab = { url: "https://gitlab.example.test", token: "test-gitlab-token" };
const jira = { url: "https://jira.example.test", user: "reader", token: "test-jira-token" };
const day = new Date(2026, 7, 31);

async function collect(t: TestContext) {
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const url = new URL(input);
    if (url.pathname === "/api/v4/merge_requests") {
      const scope = url.searchParams.get("scope") as "created_by_me" | "assigned_to_me";
      return Response.json(fixtures.gitlab[scope]);
    }
    return Response.json(fixtures.jira);
  });

  const gitlabItems = await fetchGitLab(gitlab, since);
  const jiraItems = await fetchJira(jira, since);
  return [...gitlabItems, ...jiraItems] as WorkItem[];
}

test("the full pipeline renders both sources into one bucketed digest", async (t) => {
  const items = await collect(t);
  const body = renderMarkdown(items, day).split("\n");

  assert.match(body[0], /^# Standup — /);
  assert.deepEqual(body.slice(1), [
    "",
    "## Shipped",
    "- [!42](https://gitlab.example.test/shop/api/-/merge_requests/42) Cache pricing lookups",
    "- [SHOP-118](https://jira.example.test/browse/SHOP-118) Fix rounding on invoices  (Released)",
    "",
    "## In progress",
    "- [!47](https://gitlab.example.test/shop/api/-/merge_requests/47) Add retry to the importer  (draft, has conflicts)",
    "- [!42](https://gitlab.example.test/shop/web/-/merge_requests/42) Update web checkout",
    "- [SHOP-131](https://jira.example.test/browse/SHOP-131) Split the settlement job  (In Review)",
    "",
    "## Up next",
    "- [SHOP-140](https://jira.example.test/browse/SHOP-140) Backfill legacy accounts  (Backlog)",
  ]);
});

test("closed and locked merge requests never reach the digest", async (t) => {
  const items = await collect(t);
  const markdown = renderMarkdown(items, day);

  assert.doesNotMatch(markdown, /Abandoned approach/);
  assert.doesNotMatch(markdown, /Locked request/);
});

test("a merge request shared across scopes is rendered once", async (t) => {
  const items = await collect(t);
  const markdown = renderMarkdown(items, day);

  const occurrences = markdown.split("Add retry to the importer").length - 1;
  assert.equal(occurrences, 1);
});
