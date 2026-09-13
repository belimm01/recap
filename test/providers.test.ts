import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fetchGitLab } from "../src/providers/gitlab.js";
import { fetchJira } from "../src/providers/jira.js";

const fixtures = JSON.parse(
  readFileSync(new URL("./fixtures/providers.json", import.meta.url), "utf8"),
);
const since = new Date("2026-08-28T14:30:00.000Z");
const gitlab = { url: "https://gitlab.example.test", token: "test-gitlab-token" };
const jira = { url: "https://jira.example.test", user: "reader", token: "test-jira-token" };

test("GitLab requests both scopes and maps, filters, and deduplicates merge requests by URL", async (t) => {
  const scopes: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.origin, gitlab.url);
    assert.equal(url.pathname, "/api/v4/merge_requests");
    const scope = url.searchParams.get("scope");
    assert.ok(scope === "created_by_me" || scope === "assigned_to_me");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      scope,
      updated_after: since.toISOString(),
      order_by: "updated_at",
      per_page: "100",
      page: "1",
    });
    assert.equal(new Headers(init.headers).get("PRIVATE-TOKEN"), gitlab.token);
    scopes.push(scope);
    return Response.json(fixtures.gitlab[scope]);
  });

  assert.deepEqual(await fetchGitLab(gitlab, since), [
    {
      source: "gitlab",
      ref: "!42",
      title: "Cache pricing lookups",
      url: `${gitlab.url}/shop/api/-/merge_requests/42`,
      bucket: "shipped",
      notes: [],
    },
    {
      source: "gitlab",
      ref: "!47",
      title: "Add retry to the importer",
      url: `${gitlab.url}/shop/api/-/merge_requests/47`,
      bucket: "in-progress",
      notes: ["draft", "has conflicts"],
    },
    {
      source: "gitlab",
      ref: "!42",
      title: "Update web checkout",
      url: `${gitlab.url}/shop/web/-/merge_requests/42`,
      bucket: "in-progress",
      notes: [],
    },
  ]);
  assert.deepEqual(scopes, ["created_by_me", "assigned_to_me"]);
});

test("Jira requests assigned issues and maps status categories independently of display names", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.origin, jira.url);
    assert.equal(url.pathname, "/rest/api/2/search");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      jql: 'assignee = currentUser() AND updated >= "2026-08-28" ORDER BY updated DESC',
      fields: "summary,status",
      startAt: "0",
      maxResults: "50",
    });
    const headers = new Headers(init.headers);
    assert.equal(
      headers.get("Authorization"),
      `Basic ${Buffer.from(`${jira.user}:${jira.token}`).toString("base64")}`,
    );
    assert.equal(headers.get("Accept"), "application/json");
    return Response.json(fixtures.jira);
  });

  assert.deepEqual(await fetchJira(jira, since), [
    {
      source: "jira",
      ref: "SHOP-118",
      title: "Fix rounding on invoices",
      url: `${jira.url}/browse/SHOP-118`,
      bucket: "shipped",
      notes: ["Released"],
    },
    {
      source: "jira",
      ref: "SHOP-131",
      title: "Split the settlement job",
      url: `${jira.url}/browse/SHOP-131`,
      bucket: "in-progress",
      notes: ["In Review"],
    },
    {
      source: "jira",
      ref: "SHOP-140",
      title: "Backfill legacy accounts",
      url: `${jira.url}/browse/SHOP-140`,
      bucket: "up-next",
      notes: ["Backlog"],
    },
  ]);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("providers return no work items for empty result sets", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string) =>
    Response.json(new URL(input).origin === gitlab.url ? [] : { issues: [], total: 0 }),
  );
  assert.deepEqual(await fetchGitLab(gitlab, since), []);
  assert.deepEqual(await fetchJira(jira, since), []);
  assert.equal(fetchMock.mock.callCount(), 3);
});

test("providers reject authentication failures instead of returning an empty digest", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 401, statusText: "Unauthorized" }),
  );
  await assert.rejects(fetchGitLab(gitlab, since), /request failed \(401 Unauthorized\)/);
  await assert.rejects(fetchJira(jira, since), /request failed \(401 Unauthorized\)/);
  assert.equal(fetchMock.mock.callCount(), 2);
});
