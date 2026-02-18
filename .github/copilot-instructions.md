<!--
Brief: Guidance for AI coding agents working on the svelte_geo repo.
Note: This file was generated after a repository scan that found no discoverable source files or agent docs.
If you (the human) later add source files, re-run the repo scan and update this file to include references to concrete files.
-->

# Copilot / AI agent instructions — svelte_geo

Summary
- Repo scan: no source files, build files, or agent docs (README/AGENT.md/.github workflows) were found at generation time.
- This document explains how an AI agent should proceed when a repo snapshot is empty, and lists the exact places to check when code appears.

Quick-start checks (what an agent should run first)
- List the workspace root and show hidden files to confirm there really is no code: `dir -Force` (PowerShell).
- Check git state and current branch: `git status` and `git rev-parse --abbrev-ref HEAD`.
- List committed files on HEAD: `git ls-tree -r --name-only HEAD`.

What to look for (priority order)
- Project manifest files (presence implies language/runtime): `package.json`, `pyproject.toml`, `requirements.txt`, `Pipfile`, `pom.xml`, `build.gradle`, `Cargo.toml`.
- Top-level source directories: `src/`, `app/`, `server/`, `web/`, `packages/`, `frontend/`, `backend/`.
- Docker and infra: `Dockerfile`, `docker-compose.yml`, `k8s/`, `infra/`.
- CI / workflows: `.github/workflows/*` (examine for build/test commands to follow).

Big-picture guidance (when code exists)
- Determine the primary runtime from manifests (Node/Python/Go/.NET). Use the manifest to pick build/test commands.
- Trace dataflows by finding API entrypoints: look for `server`, `app.py`, `index.js`, `main.go`, or web frameworks (Express, FastAPI, Flask, Django).
- Identify cross-component boundaries by folders (e.g., `frontend/` vs `backend/`) and shared interfaces (OpenAPI specs, protobufs, shared `types` packages).

Project-specific notes (discoverable/observable)
- Currently no files to cite as examples. When present, prefer referencing the exact file (e.g., `package.json` -> `scripts.test` or `src/index.js` -> HTTP server startup).
- If you add or find a `.github/workflows` YAML, mirror its steps for local runs (e.g., the workflow's `run` entries often show the canonical build/test commands).

Agent operating contract (inputs / outputs / success criteria)
- Input: current repo tree and HEAD commit.
- Output: minimal, runnable edits (create files, add tests, update manifests) plus a short verification report.
- Success: change compiles or tests run locally (when applicable) and no new lint/type errors are introduced.

Edge cases and how to handle them
- Empty repo: ask the user for the intended language or the path to the project root. Offer a short checklist of likely root files to upload.
- Partial repo (only infra or docs): surface the infra files and ask clarifying questions before modifying them.
- Multiple services: prefer making changes in one service at a time. Detect monorepo patterns (`packages/`, `services/`) and ask which to prioritize.

If you need clarification
- If the repo is intentionally empty, ask the repo owner which directory contains the project or whether you should initialize a new project scaffold (specify language/runtime preference).

Next steps for humans
- If you want an AI to continue, please either (A) push the project code or (B) tell the agent which directory in this workspace holds the project and the primary runtime.

Please review this file and tell me which parts are missing or which directories/files to prioritize; I will iterate the instructions and include concrete examples from the codebase.

---

Svelte scaffold notes (added by the agent)
- A minimal Vite + Svelte scaffold was added to this repo so you can start developing immediately. Files added at the repo root:
	- `package.json`, `vite.config.js`, `svelte.config.js`, `index.html`
	- `src/main.js`, `src/App.svelte`
	- `README.md`, `.gitignore`

- How to run locally (PowerShell):

```powershell
npm install
npm run dev
```

- Conventions used in this scaffold:
	- Single-page Svelte app (no routing). Keep reusable components under `src/lib/` or `src/components/`.
	- Use `.env` for environment variables, prefixed with `VITE_` for public exposure.

- Typical next changes an AI agent might make:
	1. Convert to SvelteKit for SSR/routing if required.
	2. Add TypeScript support (`tsconfig.json`, rename .js to .ts/.svelte typing) if the team prefers typed code.
	3. Add a CSS tooling stack (Tailwind/PostCSS) or component library.
	4. Add Vitest + @testing-library/svelte and a CI workflow.

If you want the agent to proceed with any of the next steps above, tell me which one (SvelteKit, TypeScript, Tailwind, testing, CI), and I'll scaffold it and update these instructions with concrete file references and commands.
