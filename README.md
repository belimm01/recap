# recap

[![CI](https://github.com/belimm01/recap/actions/workflows/ci.yml/badge.svg)](https://github.com/belimm01/recap/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Turn your GitLab merge requests and Jira issues into a paste-ready standup digest.

`recap` looks at what you've been working on since the last working day and
sorts it into the three questions every standup asks — what you **shipped**,
what's **in progress**, and what's **up next** — then prints it for the
terminal or as Markdown you can drop into Slack, Teams or a Jira comment.

```
Standup — Mon, Aug 31

Shipped
  ◆ !42       Cache pricing lookups
  ● ABC-118   Fix rounding on invoices  (Done)

In progress
  ◆ !47       Add retry to the importer  (draft)
  ● ABC-131   Split the settlement job  (In Review)

Up next
  ● ABC-140   Backfill legacy accounts  (To Do)
```

## Install

```bash
git clone https://github.com/belimm01/recap.git
cd recap
npm install
npm run build
npm link   # optional: makes `recap` available everywhere
```

## Configure

Copy the example env file and fill in whichever providers you use — `recap`
enables a provider only when its variables are set, and skips the rest.

```bash
cp .env.example .env
```

| Variable                              | Notes                                             |
| ------------------------------------- | ------------------------------------------------- |
| `GITLAB_URL`, `GITLAB_TOKEN`          | Token needs the `read_api` scope.                 |
| `JIRA_URL`, `JIRA_USER`, `JIRA_TOKEN` | Cloud: user is your email. Server: your username. |

Your `.env` is git-ignored — tokens never leave your machine.

> Jira uses the `/rest/api/2/search` endpoint, which covers Jira Server / Data
> Center and older Cloud instances.

## Usage

```bash
recap                 # last working day, printed to the terminal
recap --since 3d      # look back three days (also accepts e.g. 12h, 1w)
recap --format md     # Markdown, ready to paste into a standup channel
```

During development you can skip the build step with `npm run dev -- --since 2d`.

## How it decides

- **GitLab** — merge requests you authored or were assigned, updated in the
  window. Merged ones are _shipped_, open ones are _in progress_. Drafts and
  conflicts are flagged.
- **Jira** — issues assigned to you, updated in the window. The status
  category maps onto the buckets: done → _shipped_, in progress →
  _in progress_, everything else → _up next_.

## License

MIT
