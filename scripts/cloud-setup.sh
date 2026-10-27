#!/usr/bin/env bash
# Environment setup script for Claude Code cloud sessions (claude.ai/code).
# Paste the contents (or `bash scripts/cloud-setup.sh`) into the cloud environment's setup script.
# Cloud setup output is cached for about 7 days; this takes a few minutes, mostly pulling images.
set -u

# Installs everything, including the pinned Supabase CLI (root devDependency).
pnpm install --frozen-lockfile

# Start and stop the local backend once so the Docker images are pulled and cached.
# Failures are not fatal: a session can still do everything that doesn't need the database.
pnpm exec supabase start </dev/null || true
pnpm exec supabase stop </dev/null || true
