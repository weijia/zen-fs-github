import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GithubFS } from '../src/github-fs.js';
import { S_IFREG, S_IFDIR } from '@zenfs/core/constants';

describe('GithubFS', () => {
	let fs: GithubFS;
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	function mockTreeResponse(tree: any[]) {
		return {
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => ({ tree }),
			text: async () => JSON.stringify({ tree }),
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response;
	}

	function mockRawResponse(text: string) {
		return {
			ok: true,
			status: 200,
			headers: new Headers({}),
			json: async () => ({}),
			text: async () => text,
			arrayBuffer: async () => new TextEncoder().encode(text),
		} as Response;
	}

	function mockOkJson(data: any) {
		return {
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => data,
			text: async () => JSON.stringify(data),
			arrayBuffer: async () => new ArrayBuffer(0),
		} as Response;
	}

	beforeEach(() => {
		fs = new GithubFS({
			token: 'ghp_test-token',
			owner: 'test-owner',
			repo: 'test-repo',
			branch: 'main',
		});
		fetchSpy = vi.spyOn(globalThis, 'fetch');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('init', () => {
		it('builds index from tree', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'src', type: 'tree', sha: 'tree-sha-1', mode: '040000' },
				{ path: 'src/index.ts', type: 'blob', sha: 'blob-sha-1', size: 42, mode: '100644' },
				{ path: 'README.md', type: 'blob', sha: 'blob-sha-2', size: 12, mode: '100644' },
			]));

			await fs.init();

			expect(fs.index.has('/')).toBe(true);
			expect(fs.index.has('/src')).toBe(true);
			expect(fs.index.has('/src/index.ts')).toBe(true);
			expect(fs.index.has('/README.md')).toBe(true);

			const srcNode = fs.index.get('/src')!;
			expect((srcNode.mode & S_IFDIR) === S_IFDIR).toBe(true);

			const fileNode = fs.index.get('/src/index.ts')!;
			expect(fileNode.size).toBe(42);
			expect((fileNode.mode & S_IFREG) === S_IFREG).toBe(true);

			expect(fs.shaCache.get('/src/index.ts')).toBe('blob-sha-1');
			expect(fs.shaCache.get('/README.md')).toBe('blob-sha-2');
		});

		it('creates root if tree is empty', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([]));
			await fs.init();
			expect(fs.index.has('/')).toBe(true);
		});

		it('skips non-blob/non-tree items (e.g. submodules)', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'vendor', type: 'commit', sha: 'sub-sha', mode: '160000' },
				{ path: 'file.txt', type: 'blob', sha: 'blob-sha', size: 5, mode: '100644' },
			]));

			await fs.init();

			expect(fs.index.has('/file.txt')).toBe(true);
			expect(fs.index.has('/vendor')).toBe(false);
		});
	});

	describe('read', () => {
		it('fetches and caches file content', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'test.txt', type: 'blob', sha: 'abc', size: 5, mode: '100644' },
			]));
			await fs.init();

			fetchSpy.mockResolvedValueOnce(mockRawResponse('hello'));
			const buffer = new Uint8Array(5);
			await fs.read('/test.txt', buffer, 0, 5);

			expect(new TextDecoder().decode(buffer)).toBe('hello');
			expect(fs.contentCache.has('/test.txt')).toBe(true);
		});

		it('reads from cache on second call', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'test.txt', type: 'blob', sha: 'abc', size: 5, mode: '100644' },
			]));
			await fs.init();

			fetchSpy.mockResolvedValueOnce(mockRawResponse('hello'));
			const buf1 = new Uint8Array(5);
			await fs.read('/test.txt', buf1, 0, 5);

			const buf2 = new Uint8Array(5);
			await fs.read('/test.txt', buf2, 0, 5);

			expect(fetchSpy).toHaveBeenCalledTimes(2); // tree + 1 raw
		});

		it('supports partial reads', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'test.txt', type: 'blob', sha: 'abc', size: 5, mode: '100644' },
			]));
			await fs.init();

			fs.contentCache.set('/test.txt', new TextEncoder().encode('hello'));
			const buffer = new Uint8Array(2);
			await fs.read('/test.txt', buffer, 1, 3);

			expect(new TextDecoder().decode(buffer)).toBe('el');
		});

		it('handles zero-length read', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'test.txt', type: 'blob', sha: 'abc', size: 0, mode: '100644' },
			]));
			await fs.init();

			const buffer = new Uint8Array(10);
			await fs.read('/test.txt', buffer, 0, 0);
			// No error, buffer unchanged
		});
	});

	describe('readSync', () => {
		it('reads from cache', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'test.txt', type: 'blob', sha: 'abc', size: 5, mode: '100644' },
			]));
			await fs.init();

			fs.contentCache.set('/test.txt', new TextEncoder().encode('hello'));
			const buffer = new Uint8Array(5);
			fs.readSync('/test.txt', buffer, 0, 5);
			expect(new TextDecoder().decode(buffer)).toBe('hello');
		});

		it('throws EAGAIN if not cached', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'test.txt', type: 'blob', sha: 'abc', size: 5, mode: '100644' },
			]));
			await fs.init();

			const buffer = new Uint8Array(5);
			expect(() => fs.readSync('/test.txt', buffer, 0, 5)).toThrow();
		});
	});

	describe('write', () => {
		it('creates new file via PUT (GitHub uses PUT for both create and update)', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([]));
			await fs.init();

			fs.createFileSync('/new.txt', { mode: 0o644, uid: 0, gid: 0 });

			fetchSpy.mockResolvedValueOnce(mockOkJson({ content: { sha: 'new-sha' } }));
			const data = new TextEncoder().encode('world');
			await fs.write('/new.txt', data, 0);

			const [_url, init] = fetchSpy.mock.calls[1];
			expect(init?.method).toBe('PUT');
			expect(fs.contentCache.get('/new.txt')!).toEqual(data);
		});

		it('updates existing file via PUT with sha', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'exist.txt', type: 'blob', sha: 'old-sha', size: 3, mode: '100644' },
			]));
			await fs.init();

			fetchSpy.mockResolvedValueOnce(mockOkJson({ content: { sha: 'new-sha' } }));
			const data = new TextEncoder().encode('xyz');
			await fs.write('/exist.txt', data, 0);

			const [_url, init] = fetchSpy.mock.calls[1];
			expect(init?.method).toBe('PUT');
			const body = JSON.parse(init?.body as string);
			expect(body.sha).toBe('old-sha');
		});

		it('merges data at offset', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([]));
			await fs.init();

			fs.createFileSync('/merge.txt', { mode: 0o644, uid: 0, gid: 0 });

			// First write
			fetchSpy.mockResolvedValueOnce(mockOkJson({ content: { sha: 'sha1' } }));
			await fs.write('/merge.txt', new TextEncoder().encode('hello'), 0);

			// Second write at offset
			fetchSpy.mockResolvedValueOnce(mockOkJson({ content: { sha: 'sha2' } }));
			await fs.write('/merge.txt', new TextEncoder().encode(' world'), 5);

			const cached = fs.contentCache.get('/merge.txt')!;
			expect(new TextDecoder().decode(cached)).toBe('hello world');
		});
	});

	describe('writeSync', () => {
		it('updates cache and queues background write', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([]));
			await fs.init();

			fs.createFileSync('/sync.txt', { mode: 0o644, uid: 0, gid: 0 });

			fetchSpy.mockResolvedValueOnce(mockOkJson({ content: { sha: 'new-sha' } }));
			const data = new TextEncoder().encode('sync-data');
			fs.writeSync('/sync.txt', data, 0);

			expect(fs.contentCache.get('/sync.txt')!).toEqual(data);
			await fs.sync();
			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('remove / removeSync', () => {
		it('deletes file via API', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'del.txt', type: 'blob', sha: 'del-sha', size: 1, mode: '100644' },
			]));
			await fs.init();

			fetchSpy.mockResolvedValueOnce(mockOkJson({ commit: { sha: 'c' } }));
			await fs.remove('/del.txt');

			expect(fs.shaCache.has('/del.txt')).toBe(false);
			expect(fs.contentCache.has('/del.txt')).toBe(false);
		});

		it('removeSync queues background delete', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'del.txt', type: 'blob', sha: 'del-sha', size: 1, mode: '100644' },
			]));
			await fs.init();

			fetchSpy.mockResolvedValueOnce(mockOkJson({ commit: { sha: 'c' } }));
			fs.removeSync('/del.txt');

			expect(fs.contentCache.has('/del.txt')).toBe(false);
			await fs.sync();
			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('readdir', () => {
		it('lists directory entries', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'src', type: 'tree', sha: 't1', mode: '040000' },
				{ path: 'src/a.ts', type: 'blob', sha: 'b1', size: 1, mode: '100644' },
				{ path: 'src/b.ts', type: 'blob', sha: 'b2', size: 1, mode: '100644' },
				{ path: 'README.md', type: 'blob', sha: 'b3', size: 1, mode: '100644' },
			]));
			await fs.init();

			const entries = fs.readdirSync('/src');
			expect(entries).toContain('a.ts');
			expect(entries).toContain('b.ts');
		});

		it('lists root entries', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'src', type: 'tree', sha: 't1', mode: '040000' },
				{ path: 'README.md', type: 'blob', sha: 'b1', size: 1, mode: '100644' },
			]));
			await fs.init();

			const entries = fs.readdirSync('/');
			expect(entries).toContain('src');
			expect(entries).toContain('README.md');
		});
	});

	describe('stat', () => {
		it('returns inode for file', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'file.txt', type: 'blob', sha: 'abc', size: 123, mode: '100644' },
			]));
			await fs.init();

			const inode = fs.statSync('/file.txt');
			expect(inode.size).toBe(123);
			expect((inode.mode & S_IFREG) === S_IFREG).toBe(true);
		});

		it('returns inode for directory', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([
				{ path: 'docs', type: 'tree', sha: 'tree-abc', mode: '040000' },
			]));
			await fs.init();

			const inode = fs.statSync('/docs');
			expect((inode.mode & S_IFDIR) === S_IFDIR).toBe(true);
		});

		it('throws ENOENT for missing path', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([]));
			await fs.init();

			expect(() => fs.statSync('/missing')).toThrow();
		});
	});

	describe('ready', () => {
		it('throws EAGAIN on readySync if not initialized', () => {
			expect(() => fs.readySync()).toThrow();
		});

		it('readySync succeeds after init', async () => {
			fetchSpy.mockResolvedValueOnce(mockTreeResponse([]));
			await fs.init();
			expect(() => fs.readySync()).not.toThrow();
		});
	});

	describe('fs name and type', () => {
		it('has correct name', () => {
			expect(fs.name).toBe('github');
		});
	});
});