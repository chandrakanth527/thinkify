# Repository Guidelines

## Project Structure & Module Organization
The Vite + React TypeScript app keeps all runtime code in `src/`, with `src/main.tsx` bootstrapping the chosen mindmap experience. Auto-layout logic lives in `src/layout/node` and `src/layout/edge`, while UI wrappers sit in `src/components` and reactive stores in `src/states`. Domain data and fixture nodes reside in `src/data`, and `TestMindmap.tsx` provides a quick manual harness. Static assets belong in `public/`, and build configuration is centralized in `vite.config.ts` and the `tsconfig*.json` files.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies via the pinned pnpm toolchain.
- `pnpm dev` — run the Vite dev server at `http://localhost:5173` with hot reload.
- `pnpm build` — type-check with `tsc` and emit the production bundle.
- `pnpm preview` — inspect the built bundle locally before deploying.
- `pnpm lint` — apply Biome formatting and enforce project lint rules.
- `pnpm exec lefthook run pre-commit` — simulate git hooks defined by the shared lefthook config.

## Coding Style & Naming Conventions
TypeScript and JSX use 2-space indentation and trailing commas where Biome enforces them. Components and layout helpers follow PascalCase filenames (`EdgeController.tsx`), while utilities and data modules stay camelCase (`smart-edge.ts`). Prefix reusable hooks with `use`, prefer named exports, and colocate related styles beside their component. Run `pnpm lint` before committing so the shared `biome.json` stays authoritative.

## Testing Guidelines
There is no automated suite yet; new features should introduce Vitest-based coverage with files named `*.test.ts[x]` colocated with the code they verify. Mock edge cases with fixtures from `src/data` and assert on layout decisions instead of DOM minutiae. Until tests exist, validate changes through `TestMindmap.tsx` under `pnpm dev`, documenting manual scenarios in the PR. Keep snapshot data small and deterministic.

## Commit & Pull Request Guidelines
Commit messages follow Conventional Commits as seen in history (`refactor:`, `docs:`); keep the subject in imperative mood and scope to a feature area (`layout`, `edges`). Before opening a PR, ensure `pnpm lint` and `pnpm build` succeed and describe the motivation, notable implementation decisions, and manual/automated checks. Attach screenshots or screen recordings for UI changes and link related issues to streamline review.
