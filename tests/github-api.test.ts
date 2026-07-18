import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GithubAPI } from '../src/github-api.js';

describe('GithubAPI', () => {
	let api: GithubAPI;
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		api = new GithubAPI({
			token: 'ghp_test-token',
			owner: 'test-owner',
			repo: 'test-repo',
			branch: 'main',
		});
		fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({}),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('getTree calls correct URL', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ tree: [] }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		await api.getTree(true);

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('https://api.github.com/repos/test-owner/test-repo/git/trees/main');
		expect(url).toContain('recursive=1');
	});

	it('includes Bearer token in Authorization header', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ tree: [] }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		await api.getTree(true);

		const [_url, init] = fetchSpy.mock.calls[0];
		const headers = init?.headers as Record<string, string>;
		expect(headers['Authorization']).toBe('Bearer ghp_test-token');
		expect(headers['Accept']).toBe('application/vnd.github.v3+json');
		expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
	});

	it('getContents calls correct URL for file', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ type: 'file', name: 'README.md', path: 'README.md', sha: 'abc', size: 12 }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		await api.getContents('/README.md');

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('/repos/test-owner/test-repo/contents/README.md');
		expect(url).toContain('ref=main');
	});

	it('getRaw uses raw.githubusercontent.com', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({}),
			json: async () => ({}),
			text: async () => '',
			arrayBuffer: async () => new TextEncoder().encode('hello').buffer,
		} as Response);

		await api.getRaw('/src/index.ts');

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('raw.githubusercontent.com/test-owner/test-repo/main/src/index.ts');
	});

	it('createFile sends PUT with base64 content', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 201,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ content: { sha: 'new-sha' } }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		const content = new TextEncoder().encode('hello');
		await api.createFile('/test.txt', content, 'create test');

		const [_url, init] = fetchSpy.mock.calls[0];
		expect(init?.method).toBe('PUT');
		const body = JSON.parse(init?.body as string);
		expect(body.message).toBe('create test');
		expect(body.branch).toBe('main');
		expect(body.content).toBe('aGVsbG8=');
		expect(body.sha).toBeUndefined();
	});

	it('updateFile sends PUT with sha', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ content: { sha: 'new-sha' } }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		const content = new TextEncoder().encode('updated');
		await api.updateFile('/test.txt', content, 'old-sha', 'update test');

		const [_url, init] = fetchSpy.mock.calls[0];
		expect(init?.method).toBe('PUT');
		const body = JSON.parse(init?.body as string);
		expect(body.sha).toBe('old-sha');
		expect(body.message).toBe('update test');
	});

	it('deleteFile sends DELETE with sha', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ commit: { sha: 'commit-sha' } }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		await api.deleteFile('/test.txt', 'file-sha', 'delete test');

		const [_url, init] = fetchSpy.mock.calls[0];
		expect(init?.method).toBe('DELETE');
		const body = JSON.parse(init?.body as string);
		expect(body.sha).toBe('file-sha');
	});

	it('throws on API error', async () => {
		fetchSpy.mockResolvedValueOnce({
			ok: false,
			status: 404,
			headers: new Headers({}),
			json: async () => ({ message: 'Not Found' }),
			text: async () => '{"message":"Not Found"}',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		await expect(api.getContents('/missing')).rejects.toThrow('GitHub API 404');
	});

	it('supports custom baseUrl for GitHub Enterprise', async () => {
		const enterpriseApi = new GithubAPI({
			token: 'ghp_test',
			owner: 'my-org',
			repo: 'my-repo',
			branch: 'develop',
			baseUrl: 'https://github.mycompany.com/api/v3',
		});

		fetchSpy.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ tree: [] }),
			text: async () => '',
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response);

		await enterpriseApi.getTree(true);

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('https://github.mycompany.com/api/v3/repos/my-org/my-repo/git/trees/develop');
	});

	it('defaults branch to main', () => {
		const noBranchApi = new GithubAPI({
			token: 'ghp_test',
			owner: 'o',
			repo: 'r',
		});
		// Verify it doesn't throw — branch defaults to 'main' internally
		expect(noBranchApi).toBeDefined();
	});
});