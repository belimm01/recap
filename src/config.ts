import "dotenv/config";

export interface GitLabConfig {
  url: string;
  token: string;
}

export interface JiraConfig {
  url: string;
  user: string;
  token: string;
}

export interface Config {
  gitlab?: GitLabConfig;
  jira?: JiraConfig;
}

/**
 * Read config from the environment. A provider is only enabled when all of
 * its variables are present, so you can run recap with just GitLab, just
 * Jira, or both.
 */
export function loadConfig(): Config {
  const config: Config = {};

  const gitlabToken = process.env.GITLAB_TOKEN?.trim();
  if (gitlabToken) {
    config.gitlab = {
      url: stripTrailingSlash(process.env.GITLAB_URL?.trim() || "https://gitlab.com"),
      token: gitlabToken,
    };
  }

  const jiraUrl = process.env.JIRA_URL?.trim();
  const jiraUser = process.env.JIRA_USER?.trim();
  const jiraToken = process.env.JIRA_TOKEN?.trim();
  if (jiraUrl && jiraUser && jiraToken) {
    config.jira = { url: stripTrailingSlash(jiraUrl), user: jiraUser, token: jiraToken };
  }

  return config;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
