#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command, Option } from "commander";
import pc from "picocolors";
import { loadConfig } from "./config.js";
import { resolveSince } from "./digest.js";
import { fetchGitLab } from "./providers/gitlab.js";
import { fetchJira } from "./providers/jira.js";
import { renderMarkdown, renderTerminal } from "./render.js";
import type { WorkItem } from "./types.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const program = new Command();

program
  .name("recap")
  .description("Turn your GitLab merge requests and Jira issues into a standup digest.")
  .version(version)
  .option(
    "-s, --since <window>",
    "how far back to look, e.g. 1d, 3d, 12h (default: last working day)",
  )
  .addOption(
    new Option("-f, --format <format>", "output format")
      .choices(["terminal", "md"])
      .default("terminal"),
  )
  .action(main);

program.parseAsync().catch((error: unknown) => {
  console.error(pc.red(`recap: ${message(error)}`));
  process.exit(1);
});

async function main(options: { since?: string; format: "terminal" | "md" }): Promise<void> {
  const config = loadConfig();
  if (!config.gitlab && !config.jira) {
    console.error(
      pc.yellow(
        "No providers configured. Copy .env.example to .env and add a GitLab or Jira token.",
      ),
    );
    process.exit(1);
  }

  const since = resolveSince(options.since);
  const now = new Date();

  const jobs: Promise<WorkItem[] | null>[] = [];
  if (config.gitlab) jobs.push(guard("GitLab", fetchGitLab(config.gitlab, since)));
  if (config.jira) jobs.push(guard("Jira", fetchJira(config.jira, since)));

  const results = await Promise.all(jobs);
  if (results.every((result) => result === null)) {
    process.exit(1);
  }

  const items = results.filter((result): result is WorkItem[] => result !== null).flat();
  const output = options.format === "md" ? renderMarkdown(items, now) : renderTerminal(items, now);
  console.log(output);
}

async function guard(name: string, job: Promise<WorkItem[]>): Promise<WorkItem[] | null> {
  try {
    return await job;
  } catch (error) {
    console.error(pc.yellow(`Skipped ${name}: ${message(error)}`));
    return null;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
