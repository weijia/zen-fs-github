import type { GithubOptions } from './types.js';
export interface GithubTreeItem {
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
}
export interface GithubContentItem {
    type: 'file' | 'dir';
    name: string;
    path: string;
    sha: string;
    size: number;
    content?: string;
    encoding?: 'base64';
    download_url?: string;
}
/**
 * GitHub REST API v3 wrapper for repository contents operations.
 * Uses `Authorization: Bearer` header (supports fine-grained PATs).
 */
export declare class GithubAPI {
    private token;
    private owner;
    private repo;
    private branch;
    private baseUrl;
    constructor(options: GithubOptions);
    private headers;
    request(path: string, init?: RequestInit): Promise<any>;
    getTree(recursive?: boolean): Promise<GithubTreeItem[]>;
    /**
     * Get the latest commit SHA of a branch.
     */
    getBranchSha(branch: string): Promise<string>;
    /**
     * Create a new branch from an existing branch or commit SHA.
     *
     * Strategy:
     *  1. Try the git/refs API (standard GitHub approach).
     *  2. If the repo is empty (no branches / refs at all), GitHub returns
     *     422 "Reference already exists" or 404 for the base ref. Fall back
     *     to the Contents API which implicitly creates the branch on commit.
     */
    createBranch(newBranch: string, fromRef?: string): Promise<void>;
    getContents(path: string): Promise<GithubContentItem | GithubContentItem[]>;
    getRaw(path: string): Promise<ArrayBuffer>;
    /**
     * Create a new file. Returns the new blob SHA.
     */
    createFile(path: string, content: Uint8Array, message: string): Promise<string>;
    /**
     * Update an existing file. Returns the new blob SHA.
     * On "sha does not match" error, fetches the current SHA and retries once.
     */
    updateFile(path: string, content: Uint8Array, sha: string, message: string): Promise<string>;
    /**
     * Delete a file.
     * On "sha does not match" error, fetches the current SHA and retries once.
     */
    deleteFile(path: string, sha: string, message: string): Promise<void>;
    /**
     * Get the current blob SHA of a file via the Contents API.
     */
    getFileSha(path: string): Promise<string | null>;
    /**
     * Get the last commit for a specific file path.
     * Returns the committer date as an ISO string and the commit SHA.
     */
    getLastCommit(path: string): Promise<{
        date: string;
        sha: string;
    } | null>;
}
//# sourceMappingURL=github-api.d.ts.map