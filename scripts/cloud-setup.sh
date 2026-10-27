#!/usr/bin/env bash
# Environment setup script for Claude Code cloud sessions (claude.ai/code).
# Paste the contents (or `bash scripts/cloud-setup.sh`) into the cloud environment's setup script.
# Cloud setup output is cached for about 7 days; this takes a few minutes, mostly pulling images.
#
# It stops on the first real error, so a broken environment is never cached.
# Only the Supabase image pre-pull is allowed to fail.
set -euo pipefail

# Work from the repo root, wherever this was started from.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  cd "$CLAUDE_PROJECT_DIR"
else
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
fi
echo "[cloud-setup] Repo root: $(pwd)"

echo "[cloud-setup] 1/2 Installing dependencies (includes the pinned Supabase CLI)..."
pnpm install --frozen-lockfile

# Start and stop the local backend once so the Docker images are pulled and cached.
# Failures are not fatal: a session can still do everything that doesn't need the database.
echo "[cloud-setup] 2/2 Pre-pulling Supabase Docker images (failure here is not fatal)..."
pnpm exec supabase start </dev/null || echo "[cloud-setup] Warning: supabase start failed; continuing."
pnpm exec supabase stop </dev/null || echo "[cloud-setup] Warning: supabase stop failed; continuing."

echo "[cloud-setup] Done."
