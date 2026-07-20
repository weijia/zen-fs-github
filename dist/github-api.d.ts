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
     */
    createBranch(newBranch: string, fromRef?: string): Promise<void>;
    getContents(path: string): Promise<GithubContentItem | GithubContentItem[]>;
    getRaw(path: string): Promise<ArrayBuffer>;
    createFile(path: string, content: Uint8Array, message: string): Promise<void>;
    updateFile(path: string, content: Uint8Array, sha: string, message: string): Promise<void>;
    deleteFile(path: string, sha: string, message: string): Promise<void>;
}
//# sourceMappingURL=github-api.d.ts.map