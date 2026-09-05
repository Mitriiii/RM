import { fileURLToPath } from 'node:url';

/**
 * Resolves a path under this package's own `data/` directory, regardless of the calling
 * process's current working directory. A caller in another workspace package (e.g. apps/web
 * loading the real factor set to render a UI) shouldn't need to know where this package
 * physically lives on disk, or re-derive it via `process.cwd()` tricks that break depending on
 * where the process was started from.
 */
export function resolveFactorDataPath(relativePath: string): string {
  return fileURLToPath(new URL(`../data/${relativePath}`, import.meta.url));
}
