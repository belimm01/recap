import pc from "picocolors";
import { groupByBucket } from "./digest.js";
import { BUCKET_LABELS, type WorkItem } from "./types.js";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

/** Markdown you can paste straight into Slack, Teams or a Jira comment. */
export function renderMarkdown(items: WorkItem[], now = new Date()): string {
  const lines: string[] = [`# Standup — ${now.toLocaleDateString(undefined, DATE_FORMAT)}`];

  for (const [bucket, group] of groupByBucket(items)) {
    lines.push("", `## ${BUCKET_LABELS[bucket]}`);
    for (const item of group) {
      lines.push(`- [${item.ref}](${item.url}) ${item.title}${suffix(item)}`);
    }
  }

  if (items.length === 0) lines.push("", "_Nothing in this window._");
  return lines.join("\n");
}

/** A colourful version for reading in the terminal. */
export function renderTerminal(items: WorkItem[], now = new Date()): string {
  const lines: string[] = [pc.bold(`Standup — ${now.toLocaleDateString(undefined, DATE_FORMAT)}`)];

  for (const [bucket, group] of groupByBucket(items)) {
    lines.push("", pc.bold(pc.cyan(BUCKET_LABELS[bucket])));
    for (const item of group) {
      const ref = pc.dim(item.ref.padEnd(10));
      lines.push(`  ${bullet(item)} ${ref} ${item.title}${pc.yellow(suffix(item))}`);
    }
  }

  if (items.length === 0) lines.push("", pc.dim("Nothing in this window."));
  return lines.join("\n");
}

function suffix(item: WorkItem): string {
  return item.notes.length ? `  (${item.notes.join(", ")})` : "";
}

function bullet(item: WorkItem): string {
  return item.source === "gitlab" ? pc.magenta("◆") : pc.blue("●");
}
