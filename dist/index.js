/** @module */
export { GithubFS } from './github-fs.js';
import { GithubFS } from './github-fs.js';
const _Github = {
    name: 'Github',
    options: {
        token: { type: 'string', required: true },
        owner: { type: 'string', required: true },
        repo: { type: 'string', required: true },
        branch: { type: 'string', required: false },
        baseUrl: { type: 'string', required: false },
    },
    isAvailable() {
        return typeof globalThis.fetch === 'function';
    },
    async create(options) {
        const fs = new GithubFS(options);
        await fs.init();
        if (!options.disableAsyncCache) {
            await fs.preloadContents();
        }
        return fs;
    },
};
/**
 * The GitHub backend for ZenFS.
 *
 * @example
 * ```typescript
 * import { configure } from '@zenfs/core';
 * import { Github } from 'zen-fs-github';
 *
 * await configure({
 *   mounts: {
 *     '/repo': {
 *       backend: Github,
 *       token: 'YOUR_GITHUB_TOKEN',
 *       owner: 'your-name',
 *       repo: 'your-repo',
 *     }
 *   }
 * });
 * ```
 *
 * @category Backends and Configuration
 */
export const Github = _Github;
export default Github;
//# sourceMappingURL=index.js.map