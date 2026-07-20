import { apiPath, encodeBase64 } from './utils.js';
/**
 * GitHub REST API v3 wrapper for repository contents operations.
 * Uses `Authorization: Bearer` header (supports fine-grained PATs).
 */
export class GithubAPI {
    token;
    owner;
    repo;
    branch;
    baseUrl;
    constructor(options) {
        this.token = options.token;
        this.owner = options.owner;
        this.repo = options.repo;
        this.branch = options.branch || 'main';
        this.baseUrl = options.baseUrl || 'https://api.github.com';
    }
    headers() {
        return {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }
    async request(path, init) {
        const url = `${this.baseUrl}${path}`;
        console.log(`[GithubAPI] request: ${init?.method || 'GET'} ${url}`);
        const response = await fetch(url, {
            ...init,
            headers: { ...this.headers(), ...init?.headers },
        });
        console.log(`[GithubAPI] response: status=${response.status} url=${response.url} type=${response.headers.get('content-type')}`);
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.log(`[GithubAPI] ERROR body: ${text.substring(0, 500)}`);
            throw new Error(`GitHub API ${response.status}: ${text}`);
        }
        if (response.status === 204)
            return undefined;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }
        return response.arrayBuffer();
    }
    async getTree(recursive = true) {
        const data = await this.request(`/repos/${this.owner}/${this.repo}/git/trees/${this.branch}${recursive ? '?recursive=1' : ''}`);
        return data.tree || [];
    }
    /**
     * Get the latest commit SHA of a branch.
     */
    async getBranchSha(branch) {
        const data = await this.request(`/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`);
        return data.object?.sha;
    }
    /**
     * Create a new branch from an existing branch or commit SHA.
     */
    async createBranch(newBranch, fromRef = 'main') {
        console.log(`[GithubAPI] creating branch '${newBranch}' from '${fromRef}'`);
        const sha = await this.getBranchSha(fromRef);
        if (!sha)
            throw new Error(`Cannot find SHA for branch '${fromRef}'`);
        await this.request(`/repos/${this.owner}/${this.repo}/git/refs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ref: `refs/heads/${newBranch}`,
                sha,
            }),
        });
        console.log(`[GithubAPI] branch '${newBranch}' created from sha=${sha}`);
    }
    async getContents(path) {
        return this.request(`/repos/${this.owner}/${this.repo}/contents/${apiPath(path)}?ref=${this.branch}`);
    }
    async getRaw(path) {
        // Use the raw.githubusercontent.com endpoint for binary content
        const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${apiPath(path)}`;
        const response = await fetch(url, {
            headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`GitHub raw download ${response.status}: ${text}`);
        }
        return response.arrayBuffer();
    }
    async createFile(path, content, message) {
        await this.request(`/repos/${this.owner}/${this.repo}/contents/${apiPath(path)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                content: encodeBase64(content),
                branch: this.branch,
            }),
        });
    }
    async updateFile(path, content, sha, message) {
        await this.request(`/repos/${this.owner}/${this.repo}/contents/${apiPath(path)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                content: encodeBase64(content),
                sha,
                branch: this.branch,
            }),
        });
    }
    async deleteFile(path, sha, message) {
        await this.request(`/repos/${this.owner}/${this.repo}/contents/${apiPath(path)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                sha,
                branch: this.branch,
            }),
        });
    }
}
//# sourceMappingURL=github-api.js.map