import type { GithubOptions } from './types.js';
import { apiPath, encodeBase64 } from './utils.js';

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
export class GithubAPI {
	private token: string;
	private owner: string;
	private repo: string;
	private branch: string;
	private baseUrl: string;

	constructor(options: GithubOptions) {
		this.token = options.token;
		this.owner = options.owner;
		this.repo = options.repo;
		this.branch = options.branch || 'main';
		this.baseUrl = options.baseUrl || 'https://api.github.com';
	}

	private headers(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.token}`,
			Accept: 'application/vnd.github.v3+json',
			'X-GitHub-Api-Version': '2022-11-28',
		};
	}

	async request(path: string, init?: RequestInit): Promise<any> {
		const url = `${this.baseUrl}${path}`;
		console.log(`[GithubAPI] request: ${init?.method || 'GET'} ${url}`);
		const response = await fetch(url, {
			...init,
			headers: { ...this.headers(), ...(init?.headers as Record<string, string> | undefined) },
		});
		console.log(`[GithubAPI] response: status=${response.status} url=${response.url} type=${response.headers.get('content-type')}`);
		if (!response.ok) {
			const text = await response.text().catch(() => '');
			console.log(`[GithubAPI] ERROR body: ${text.substring(0, 500)}`);
			throw new Error(`GitHub API ${response.status}: ${text}`);
		}
		if (response.status === 204) return undefined;
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			return response.json();
		}
		return response.arrayBuffer();
	}

	async getTree(recursive = true): Promise<GithubTreeItem[]> {
		const data = await this.request(
			`/repos/${this.owner}/${this.repo}/git/trees/${this.branch}${recursive ? '?recursive=1' : ''}`
		);
		return data.tree || [];
	}

	async getContents(path: string): Promise<GithubContentItem | GithubContentItem[]> {
		return this.request(`/repos/${this.owner}/${this.repo}/contents/${apiPath(path)}?ref=${this.branch}`);
	}

	async getRaw(path: string): Promise<ArrayBuffer> {
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

	async createFile(path: string, content: Uint8Array, message: string): Promise<void> {
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

	async updateFile(path: string, content: Uint8Array, sha: string, message: string): Promise<void> {
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

	async deleteFile(path: string, sha: string, message: string): Promise<void> {
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