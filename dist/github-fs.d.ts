import { IndexFS } from '@zenfs/core';
import { GithubAPI } from './github-api.js';
import type { GithubOptions } from './types.js';
/**
 * A ZenFS backend for GitHub repositories.
 *
 * Implements the `FileSystem` interface by mapping file operations
 * to the GitHub REST API v3.
 */
export declare class GithubFS extends IndexFS {
    readonly api: GithubAPI;
    /** Maps file paths to their blob SHA (needed for updates/deletes). */
    readonly shaCache: Map<string, string>;
    /** In-memory content cache to support synchronous reads. */
    readonly contentCache: Map<string, Uint8Array<ArrayBufferLike>>;
    /** Serializes async background operations. */
    private pending;
    private options;
    private initialized;
    constructor(options: GithubOptions);
    /**
     * Queue an async operation to run after all previous ones finish.
     */
    private _queue;
    /**
     * Initialize the file system by loading the repository tree.
     * If the configured branch does not exist, it will be created from 'main'.
     */
    init(): Promise<void>;
    /**
     * Preload all file contents into memory cache.
     * This enables synchronous reads.
     */
    preloadContents(): Promise<void>;
    ready(): Promise<void>;
    readySync(): void;
    remove(path: string): Promise<void>;
    removeSync(path: string): void;
    read(path: string, buffer: Uint8Array, start: number, end: number): Promise<void>;
    readSync(path: string, buffer: Uint8Array, start: number, end: number): void;
    write(path: string, data: Uint8Array, offset: number): Promise<void>;
    writeSync(path: string, data: Uint8Array, offset: number): void;
    sync(): Promise<void>;
    syncSync(): void;
}
//# sourceMappingURL=github-fs.d.ts.map