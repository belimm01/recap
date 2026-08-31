import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMarkdown, renderTerminal } from "../src/render.js";
import type { WorkItem } from "../src/types.js";

const items: WorkItem[] = [
  {
    source: "gitlab",
    ref: "!1",
    title: "Cache pricing lookups",
    url: "https://gitlab.test/mr/1",
    bucket: "shipped",
    notes: ["draft"],
  },
];

const day = new Date(2026, 7, 31);

test("renderMarkdown links refs and groups by bucket", () => {
  const md = renderMarkdown(items, day);
  assert.match(md, /## Shipped/);
  assert.match(md, /\[!1\]\(https:\/\/gitlab\.test\/mr\/1\)/);
  assert.match(md, /\(draft\)/);
});

test("renderMarkdown reports an empty window", () => {
  assert.match(renderMarkdown([], day), /Nothing in this window/);
});

test("renderTerminal includes the title and bucket label", () => {
  const out = renderTerminal(items, day);
  assert.match(out, /Shipped/);
  assert.match(out, /Cache pricing lookups/);
});
