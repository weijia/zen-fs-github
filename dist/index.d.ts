/** @module */
export { GithubFS } from './github-fs.js';
export type { GithubOptions } from './types.js';
import type { Backend } from '@zenfs/core';
import { GithubFS } from './github-fs.js';
import type { GithubOptions } from './types.js';
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
export declare const Github: Backend<GithubFS, GithubOptions>;
export default Github;
//# sourceMappingURL=index.d.ts.map