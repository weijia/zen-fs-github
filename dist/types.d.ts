/**
 * Configuration options for the GitHub backend.
 */
export interface GithubOptions {
    /** GitHub personal access token. Create one at https://github.com/settings/tokens */
    token: string;
    /** Repository owner (username or organization). */
    owner: string;
    /** Repository name. */
    repo: string;
    /** Branch name. Defaults to `main`. */
    branch?: string;
    /** Base URL for the GitHub API. Defaults to `https://api.github.com`. Useful for GitHub Enterprise. */
    baseUrl?: string;
    /**
     * If true, disables preloading file contents into memory cache.
     * Sync reads will throw `EAGAIN` until the file is explicitly read asynchronously.
     */
    disableAsyncCache?: boolean;
}
//# sourceMappingURL=types.d.ts.map