export interface GitHubExportConfig {
  token: string;
  repo: string;
  title: string;
  body: string;
  labels?: string[];
  assignee?: string;
}

export interface GitHubIssueResult {
  url: string;
  number: number;
}

export async function createGitHubIssue(config: GitHubExportConfig): Promise<GitHubIssueResult> {
  const { token, repo, title, body, labels, assignee } = config;

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error('Invalid repository format. Use "owner/repo".');
  }

  const payload: Record<string, unknown> = { title, body };
  if (labels && labels.length > 0) {
    payload.labels = labels;
  }
  if (assignee) {
    payload.assignees = [assignee];
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitHub authentication failed. Check your Personal Access Token.');
    }
    if (response.status === 404) {
      throw new Error(
        `Repository "${repo}" not found. Check the owner/repo format and permissions.`,
      );
    }
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { html_url: string; number: number };
  return { url: data.html_url, number: data.number };
}
