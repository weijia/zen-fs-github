# zen-fs-github

A [ZenFS](https://github.com/zen-fs/core) backend that maps file system operations to a **GitHub** repository via the GitHub REST API v3.

This allows you to read and write files in a GitHub repo directly from the browser (or Node.js) using ZenFS's standard `fs` API.

## Installation

```bash
npm install zen-fs-github @zenfs/core
```

## Usage

```typescript
import { configure, fs } from '@zenfs/core';
import { Github } from 'zen-fs-github';

await configure({
  mounts: {
    '/repo': {
      backend: Github,
      token: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN',
      owner: 'github-username',
      repo: 'repository-name',
      branch: 'main',           // optional, defaults to main
      disableAsyncCache: false, // optional, preload file contents for sync reads
    }
  }
});

// Read a file
const content = fs.readFileSync('/repo/README.md', 'utf-8');

// Write a file
fs.writeFileSync('/repo/src/hello.ts', 'export const hello = "world";');

// List directory
const files = fs.readdirSync('/repo/src');
```

## API Reference

### `Github` Backend

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `token` | `string` | Yes | GitHub personal access token. Create one at [GitHub Settings](https://github.com/settings/tokens). Requires `repo` scope for private repos, or `public_repo` for public repos. |
| `owner` | `string` | Yes | Repository owner (username or organization). |
| `repo` | `string` | Yes | Repository name. |
| `branch` | `string` | No | Target branch. Defaults to `main`. |
| `baseUrl` | `string` | No | GitHub API base URL. Defaults to `https://api.github.com`. Set this for GitHub Enterprise. |
| `disableAsyncCache` | `boolean` | No | If `true`, disables preloading file contents. Sync reads will throw `EAGAIN` until the file is read asynchronously. |

## How it Works

- On mount, the backend fetches the repository's git tree and builds an in-memory `Index` of all files and directories.
- By default, all file contents are preloaded into memory so that **synchronous reads** work out of the box.
- Writes are translated to `PUT` requests against the GitHub Contents API (GitHub uses PUT for both create and update).
- Each write creates a new commit on the target branch.
- Raw file downloads use `raw.githubusercontent.com` for efficiency.

## Differences from zen-fs-gitee

| Feature | zen-fs-github | zen-fs-gitee |
|---------|--------------|--------------|
| API Auth | `Authorization: Bearer` header | `access_token` query param |
| Create File | `PUT` | `POST` |
| Update File | `PUT` with `sha` | `PUT` with `sha` |
| Raw Downloads | `raw.githubusercontent.com` | Gitee `/raw/` endpoint |
| Default Branch | `main` | `master` |
| GitHub Enterprise | Supported via `baseUrl` | N/A |

## Notes

- GitHub API rate limits: 5,000 requests/hour for authenticated users.
- Hard links and symbolic links are not supported (`ENOSYS`).
- The `writeFileSync` and `removeSync` methods update the local cache immediately and trigger background API calls.

## License

MIT