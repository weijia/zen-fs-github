import { withErrno } from 'kerium';
import { IndexFS, Index, Inode } from '@zenfs/core';
import { S_IFDIR, S_IFREG } from '@zenfs/core/constants';
import { GithubAPI } from './github-api.js';
/**
 * A ZenFS backend for GitHub repositories.
 *
 * Implements the `FileSystem` interface by mapping file operations
 * to the GitHub REST API v3.
 */
export class GithubFS extends IndexFS {
    api;
    /** Maps file paths to their blob SHA (needed for updates/deletes). */
    shaCache = new Map();
    /** In-memory content cache to support synchronous reads. */
    contentCache = new Map();
    /** Cached file mtime entries: path -> { sha, lastModified }. Populated lazily via Commits API. */
    mtimeCache = new Map();
    /** Serializes async background operations. */
    pending = Promise.resolve();
    options;
    initialized = false;
    constructor(options) {
        super(0x676974687562, 'github', new Index());
        this.options = options;
        this.api = new GithubAPI(options);
    }
    /**
     * Queue an async operation to run after all previous ones finish.
     */
    _queue(p) {
        this.pending = this.pending.then(() => p).catch(() => { });
    }
    /**
     * Initialize the file system by loading the repository tree.
     * If the configured branch does not exist, it will be created from 'main'.
     */
    async init() {
        if (this.initialized)
            return;
        let tree = [];
        try {
            tree = await this.api.getTree(true);
        }
        catch (err) {
            const msg = err.message || '';
            // Branch not found — try to create it
            if (msg.includes('404') || msg.includes('Not Found') || msg.includes('not found')) {
                console.log(`[GithubFS] Branch '${this.options.branch}' not found, attempting to create...`);
                await this.api.createBranch(this.options.branch || 'main', 'main');
                // Retry loading tree
                tree = await this.api.getTree(true);
            }
            else {
                throw err;
            }
        }
        for (const item of tree) {
            // GitHub trees include the item itself; skip submodules
            if (item.type !== 'blob' && item.type !== 'tree')
                continue;
            const path = '/' + item.path;
            const id = this.index._alloc();
            const isDir = item.type === 'tree';
            const inode = new Inode({
                ino: id,
                data: id + 1,
                mode: isDir ? S_IFDIR | 0o755 : S_IFREG | 0o644,
                size: item.size || 0,
                uid: 0,
                gid: 0,
                nlink: 1,
                atimeMs: Date.now(),
                mtimeMs: Date.now(),
                ctimeMs: Date.now(),
                birthtimeMs: Date.now(),
            });
            this.index.set(path, inode);
            if (!isDir) {
                this.shaCache.set(path, item.sha);
            }
        }
        // Ensure root directory exists
        if (!this.index.has('/')) {
            const id = this.index._alloc();
            this.index.set('/', new Inode({
                ino: id,
                data: id + 1,
                mode: S_IFDIR | 0o755,
                size: 0,
                uid: 0,
                gid: 0,
                nlink: 1,
                atimeMs: Date.now(),
                mtimeMs: Date.now(),
                ctimeMs: Date.now(),
                birthtimeMs: Date.now(),
            }));
        }
        this.initialized = true;
    }
    /**
     * Preload all file contents into memory cache.
     * This enables synchronous reads.
     */
    async preloadContents() {
        for (const [path, node] of this.index) {
            if ((node.mode & S_IFREG) !== S_IFREG)
                continue;
            if (this.contentCache.has(path))
                continue;
            try {
                const data = new Uint8Array(await this.api.getRaw(path));
                this.contentCache.set(path, data);
            }
            catch {
                // Ignore preload errors for individual files
            }
        }
    }
    async ready() {
        if (!this.initialized) {
            await this.init();
            if (!this.options.disableAsyncCache) {
                await this.preloadContents();
            }
        }
    }
    readySync() {
        if (!this.initialized) {
            throw withErrno('EAGAIN', 'GithubFS is not initialized');
        }
    }
    // --- Remove ---
    async remove(path) {
        const sha = this.shaCache.get(path);
        if (sha) {
            await this.api.deleteFile(path, sha, `Delete ${path}`);
            this.shaCache.delete(path);
        }
        this.contentCache.delete(path);
    }
    removeSync(path) {
        const sha = this.shaCache.get(path);
        if (sha) {
            this._queue(this.api
                .deleteFile(path, sha, `Delete ${path}`)
                .then(() => {
                this.shaCache.delete(path);
            })
                .catch(() => { }));
        }
        this.contentCache.delete(path);
    }
    // --- Read ---
    async read(path, buffer, start, end) {
        if (end - start <= 0)
            return;
        let data = this.contentCache.get(path);
        if (!data) {
            data = new Uint8Array(await this.api.getRaw(path));
            this.contentCache.set(path, data);
        }
        const length = Math.min(end - start, data.length - start, buffer.length);
        if (length > 0) {
            buffer.set(data.subarray(start, start + length));
        }
    }
    readSync(path, buffer, start, end) {
        if (end - start <= 0)
            return;
        const data = this.contentCache.get(path);
        if (!data) {
            this._queue(this.read(path, new Uint8Array(0), 0, 0).catch(() => { }));
            throw withErrno('EAGAIN', 'File content not cached, use async read instead');
        }
        const length = Math.min(end - start, data.length - start, buffer.length);
        if (length > 0) {
            buffer.set(data.subarray(start, start + length));
        }
    }
    // --- Write ---
    async write(path, data, offset) {
        let existing = this.contentCache.get(path) || new Uint8Array(0);
        const newSize = Math.max(existing.length, offset + data.length);
        const merged = new Uint8Array(newSize);
        merged.set(existing);
        merged.set(data, offset);
        this.contentCache.set(path, merged);
        const inode = this.index.get(path);
        if (inode) {
            inode.update({ mtimeMs: Date.now(), size: merged.length });
        }
        const sha = this.shaCache.get(path);
        let newSha;
        if (sha) {
            newSha = await this.api.updateFile(path, merged, sha, `Update ${path}`);
            this.shaCache.set(path, newSha);
            // Invalidate mtime cache for this file
            this.mtimeCache.delete(path);
        }
        else {
            newSha = await this.api.createFile(path, merged, `Create ${path}`);
            this.shaCache.set(path, newSha);
        }
    }
    writeSync(path, data, offset) {
        let existing = this.contentCache.get(path) || new Uint8Array(0);
        const newSize = Math.max(existing.length, offset + data.length);
        const merged = new Uint8Array(newSize);
        merged.set(existing);
        merged.set(data, offset);
        this.contentCache.set(path, merged);
        const inode = this.index.get(path);
        if (inode) {
            inode.update({ mtimeMs: Date.now(), size: merged.length });
        }
        const sha = this.shaCache.get(path);
        this._queue((sha
            ? this.api.updateFile(path, merged, sha, `Update ${path}`)
            : this.api.createFile(path, merged, `Create ${path}`))
            .then((newSha) => {
            this.shaCache.set(path, newSha);
            this.mtimeCache.delete(path);
        })
            .catch(() => { }));
    }
    // --- Sync ---
    async sync() {
        await this.pending;
    }
    syncSync() {
        // Background ops are fire-and-forget
    }
    // --- Stat (overridden to provide real mtime from Commits API) ---
    /**
     * Get the stat of a file. For regular files, this enriches the Inode's
     * mtimeMs with the real last commit date from the GitHub Commits API.
     * The first call for a file triggers an API request; subsequent calls
     * use the cached value unless the blob SHA has changed.
     */
    async stat(path) {
        const inode = await super.stat(path);
        // Only enrich mtime for regular files
        if ((inode.mode & S_IFREG) !== S_IFREG)
            return inode;
        const cached = this.mtimeCache.get(path);
        const currentSha = this.shaCache.get(path);
        // If cached SHA matches current SHA, use cached mtime
        if (cached && cached.sha === currentSha && cached.lastModified) {
            inode.update({ mtimeMs: new Date(cached.lastModified).getTime() });
            return inode;
        }
        // SHA changed or no cache — fetch from Commits API
        if (currentSha) {
            const commit = await this.api.getLastCommit(path);
            if (commit) {
                this.mtimeCache.set(path, { sha: currentSha, lastModified: commit.date });
                inode.update({ mtimeMs: new Date(commit.date).getTime() });
                return inode;
            }
        }
        return inode;
    }
    /**
     * Get the blob SHA for a file (from shaCache). Useful for external
     * revision checking (e.g. zen-fs-cache getRevision).
     */
    getFileSha(path) {
        return this.shaCache.get(path);
    }
}
//# sourceMappingURL=github-fs.js.map