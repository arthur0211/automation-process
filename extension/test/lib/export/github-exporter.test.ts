import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGitHubIssue, type GitHubExportConfig } from '@/lib/export/github-exporter';

function baseConfig(overrides: Partial<GitHubExportConfig> = {}): GitHubExportConfig {
  return {
    token: 'ghp_test123',
    repo: 'owner/repo',
    title: 'Test Issue',
    body: '## Steps\n\n1. Click button',
    ...overrides,
  };
}

describe('createGitHubIssue', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates issue with correct payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/issues/42', number: 42 }),
    });

    const result = await createGitHubIssue(baseConfig());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_test123',
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.title).toBe('Test Issue');
    expect(body.body).toBe('## Steps\n\n1. Click button');
    expect(body.labels).toBeUndefined();
    expect(body.assignees).toBeUndefined();

    expect(result).toEqual({
      url: 'https://github.com/owner/repo/issues/42',
      number: 42,
    });
  });

  it('includes labels and assignee when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/issues/7', number: 7 }),
    });

    await createGitHubIssue(
      baseConfig({
        labels: ['bug', 'documentation'],
        assignee: 'octocat',
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.labels).toEqual(['bug', 'documentation']);
    expect(body.assignees).toEqual(['octocat']);
  });

  it('handles 401 unauthorized', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"message":"Bad credentials"}',
    });

    await expect(createGitHubIssue(baseConfig())).rejects.toThrow(
      'GitHub authentication failed. Check your Personal Access Token.',
    );
  });

  it('handles 404 not found (bad repo)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => '{"message":"Not Found"}',
    });

    await expect(createGitHubIssue(baseConfig())).rejects.toThrow(
      'Repository "owner/repo" not found. Check the owner/repo format and permissions.',
    );
  });

  it('handles network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(createGitHubIssue(baseConfig())).rejects.toThrow('Failed to fetch');
  });

  it('throws on invalid repo format', async () => {
    await expect(createGitHubIssue(baseConfig({ repo: 'invalid' }))).rejects.toThrow(
      'Invalid repository format. Use "owner/repo".',
    );
  });
});
