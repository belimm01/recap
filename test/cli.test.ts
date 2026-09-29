import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { devNull } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
type ProviderState = "items" | "empty" | "failed" | "disabled";

const scenarios: {
  name: string;
  gitlab: ProviderState;
  jira: ProviderState;
  code: number;
}[] = [
  { name: "combines successful providers", gitlab: "items", jira: "items", code: 0 },
  { name: "keeps Jira when GitLab fails", gitlab: "failed", jira: "items", code: 0 },
  { name: "keeps GitLab when Jira fails", gitlab: "items", jira: "failed", code: 0 },
  { name: "accepts empty Jira when GitLab fails", gitlab: "failed", jira: "empty", code: 0 },
  { name: "accepts empty GitLab when Jira fails", gitlab: "empty", jira: "failed", code: 0 },
  { name: "fails when both providers fail", gitlab: "failed", jira: "failed", code: 1 },
  { name: "fails when the only provider fails", gitlab: "failed", jira: "disabled", code: 1 },
];

for (const scenario of scenarios) {
  test(`CLI ${scenario.name}`, { timeout: 15_000 }, async (t) => {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      requests.push(path);
      const provider =
        path === "/api/v4/merge_requests"
          ? "gitlab"
          : path === "/rest/api/2/search"
            ? "jira"
            : null;
      if (!provider || scenario[provider] === "disabled") {
        response.writeHead(404).end();
        return;
      }
      if (scenario[provider] === "failed") {
        response.writeHead(503).end("Unavailable");
        return;
      }
      const items = scenario[provider] === "items";
      const body =
        provider === "gitlab"
          ? items
            ? [
                {
                  iid: 42,
                  title: "Ship cache support",
                  web_url: "https://gitlab.example.test/team/app/-/merge_requests/42",
                  state: "merged",
                  draft: false,
                  has_conflicts: false,
                },
              ]
            : []
          : {
              total: items ? 1 : 0,
              issues: items
                ? [
                    {
                      key: "APP-7",
                      fields: {
                        summary: "Add retry handling",
                        status: {
                          name: "In Progress",
                          statusCategory: { key: "indeterminate" },
                        },
                      },
                    },
                  ]
                : [],
            };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    });
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}`;
    const env: NodeJS.ProcessEnv = {
      NO_COLOR: "1",
      DOTENV_CONFIG_PATH: devNull,
      GITLAB_URL: url,
      JIRA_URL: url,
    };
    if (scenario.gitlab !== "disabled") env.GITLAB_TOKEN = "test-gitlab-token";
    if (scenario.jira !== "disabled") {
      env.JIRA_USER = "reader";
      env.JIRA_TOKEN = "test-jira-token";
    }
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve, reject) => {
        execFile(
          process.execPath,
          ["--import", "tsx", "src/index.ts", "--since", "1d", "--format", "md"],
          { cwd: root, env, timeout: 10_000 },
          (error, stdout, stderr) => {
            if (error && (error.killed || typeof error.code !== "number")) {
              reject(error);
              return;
            }
            resolve({ code: typeof error?.code === "number" ? error.code : 0, stdout, stderr });
          },
        );
      },
    );
    assert.equal(result.code, scenario.code, result.stderr);
    const warnings = (["gitlab", "jira"] as const)
      .filter((provider) => scenario[provider] === "failed")
      .map(
        (provider) =>
          `Skipped ${provider === "gitlab" ? "GitLab" : "Jira"}: request failed (503 Service Unavailable)`,
      );
    assert.deepEqual(result.stderr.trim().split("\n").filter(Boolean).sort(), warnings.sort());
    const expectedRequests = [
      ...Array(scenario.gitlab === "failed" ? 1 : scenario.gitlab === "disabled" ? 0 : 2).fill(
        "/api/v4/merge_requests",
      ),
      ...(scenario.jira === "disabled" ? [] : ["/rest/api/2/search"]),
    ];
    assert.deepEqual(requests.sort(), expectedRequests.sort());
    if (scenario.code === 1) {
      assert.equal(result.stdout, "");
      return;
    }
    assert.match(result.stdout, /^# Standup — .+\n/);
    assert.equal(result.stdout.includes("Ship cache support"), scenario.gitlab === "items");
    assert.equal(result.stdout.includes("Add retry handling"), scenario.jira === "items");
    assert.equal(
      result.stdout.includes("_Nothing in this window._"),
      scenario.gitlab !== "items" && scenario.jira !== "items",
    );
    assert.doesNotMatch(result.stdout, /Skipped |test-gitlab-token|test-jira-token/);
  });
}
