import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchGitLab } from "../src/providers/gitlab.js";
import { fetchJira } from "../src/providers/jira.js";

const since = new Date("2026-08-28T14:30:00.000Z");
const gitlab = { url: "https://gitlab.example.test", token: "test-gitlab-token" };
const jira = { url: "https://jira.example.test", user: "reader", token: "test-jira-token" };

function mergeRequest(id: number) {
  return {
    iid: id,
    title: `Change ${id}`,
    web_url: `${gitlab.url}/team/app/-/merge_requests/${id}`,
    state: "opened",
    draft: false,
    has_conflicts: false,
  };
}

function issue(id: number) {
  return {
    key: `APP-${id}`,
    fields: {
      summary: `Task ${id}`,
      status: { name: "In Progress", statusCategory: { key: "indeterminate" } },
    },
  };
}

test("GitLab advances pages per scope and deduplicates across pages and scopes", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const params = new URL(input).searchParams;
    const key = `${params.get("scope")}:${params.get("page")}`;
    requests.push(key);
    assert.equal(params.get("per_page"), "100");
    assert.equal(params.get("updated_after"), since.toISOString());
    switch (key) {
      case "created_by_me:1":
        return Response.json(Array.from({ length: 100 }, (_, i) => mergeRequest(i + 1)));
      case "created_by_me:2":
        return Response.json([mergeRequest(100), mergeRequest(101)]);
      case "assigned_to_me:1":
        return Response.json([mergeRequest(101), mergeRequest(102)]);
      default:
        assert.fail(`Unexpected page ${key}`);
    }
  });

  const items = await fetchGitLab(gitlab, since);
  assert.deepEqual(requests, ["created_by_me:1", "created_by_me:2", "assigned_to_me:1"]);
  assert.deepEqual(
    items.map((item) => item.url),
    Array.from({ length: 102 }, (_, i) => mergeRequest(i + 1).web_url),
  );
});

test("GitLab bounds full result sets to ten pages per scope", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const params = new URL(input).searchParams;
    const scope = params.get("scope");
    const page = Number(params.get("page"));
    assert.ok(scope === "created_by_me" || scope === "assigned_to_me");
    assert.ok(page >= 1 && page <= 10);
    requests.push(`${scope}:${page}`);
    const offset = (scope === "assigned_to_me" ? 1000 : 0) + (page - 1) * 100;
    return Response.json(Array.from({ length: 100 }, (_, i) => mergeRequest(offset + i + 1)));
  });

  const items = await fetchGitLab(gitlab, since);
  assert.deepEqual(
    requests,
    ["created_by_me", "assigned_to_me"].flatMap((scope) =>
      Array.from({ length: 10 }, (_, i) => `${scope}:${i + 1}`),
    ),
  );
  assert.deepEqual(
    items.map((item) => item.url),
    Array.from({ length: 2000 }, (_, i) => mergeRequest(i + 1).web_url),
  );
});

test("Jira advances offsets and stops at the reported total or a short page", async (t) => {
  for (const total of [100, 500]) {
    const offsets: number[] = [];
    const fetchMock = t.mock.method(globalThis, "fetch", async (input: string) => {
      const params = new URL(input).searchParams;
      const offset = Number(params.get("startAt"));
      assert.equal(params.get("maxResults"), "50");
      assert.ok(offset === 0 || offset === 50);
      offsets.push(offset);
      const length = total === 500 && offset === 50 ? 2 : 50;
      return Response.json({
        total,
        issues: Array.from({ length }, (_, i) => issue(offset + i + 1)),
      });
    });

    const items = await fetchJira(jira, since);
    assert.deepEqual(offsets, [0, 50]);
    assert.deepEqual(
      items.map((item) => item.ref),
      Array.from({ length: total === 100 ? 100 : 52 }, (_, i) => `APP-${i + 1}`),
    );
    fetchMock.mock.restore();
  }
});

test("Jira bounds full result sets to two hundred issues", async (t) => {
  const offsets: number[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const offset = Number(new URL(input).searchParams.get("startAt"));
    assert.ok(offset >= 0 && offset < 200);
    offsets.push(offset);
    return Response.json({
      total: 500,
      issues: Array.from({ length: 50 }, (_, i) => issue(offset + i + 1)),
    });
  });

  const items = await fetchJira(jira, since);
  assert.deepEqual(offsets, [0, 50, 100, 150]);
  assert.deepEqual(
    items.map((item) => item.ref),
    Array.from({ length: 200 }, (_, i) => `APP-${i + 1}`),
  );
});

test("providers reject later-page failures instead of returning incomplete results", async (t) => {
  for (const provider of ["gitlab", "jira"]) {
    let requests = 0;
    const fetchMock = t.mock.method(globalThis, "fetch", async (input: string) => {
      const params = new URL(input).searchParams;
      requests++;
      assert.ok(requests <= 2);
      if (requests === 2) {
        assert.equal(
          params.get(provider === "gitlab" ? "page" : "startAt"),
          provider === "gitlab" ? "2" : "50",
        );
        return new Response(null, { status: 503, statusText: "Service Unavailable" });
      }
      return Response.json(
        provider === "gitlab"
          ? Array.from({ length: 100 }, (_, i) => mergeRequest(i + 1))
          : { total: 100, issues: Array.from({ length: 50 }, (_, i) => issue(i + 1)) },
      );
    });

    await assert.rejects(
      provider === "gitlab" ? fetchGitLab(gitlab, since) : fetchJira(jira, since),
      /request failed \(503 Service Unavailable\)/,
    );
    assert.equal(requests, 2);
    fetchMock.mock.restore();
  }
});
