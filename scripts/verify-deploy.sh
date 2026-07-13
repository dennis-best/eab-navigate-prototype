#!/usr/bin/env bash
# verify-deploy.sh
#
# Confirms the exact commit that was just pushed is actually built and being
# served by GitHub Pages before anyone reports a link as "ready" or "live".
#
# Usage:
#   scripts/verify-deploy.sh [repo] [maxWaitSeconds]
#
# Defaults:
#   repo           dennis-best/eab-navigate-prototype
#   maxWaitSeconds 180
#
# Exit codes:
#   0  - live build matches the current local HEAD commit
#   1  - timed out waiting for the build to match, or the build errored
#   2  - missing dependency (gh CLI) or not a git repo

set -uo pipefail

REPO="${1:-dennis-best/eab-navigate-prototype}"
MAX_WAIT="${2:-180}"
POLL_INTERVAL=10

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI is required." >&2
  exit 2
fi

LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null)
if [ -z "$LOCAL_SHA" ]; then
  echo "ERROR: not inside a git repo." >&2
  exit 2
fi

echo "Verifying GitHub Pages deploy for $REPO"
echo "Local HEAD: $LOCAL_SHA"

REMOTE_SHA=$(git rev-parse "origin/$(git branch --show-current)" 2>/dev/null || echo "")
if [ "$REMOTE_SHA" != "$LOCAL_SHA" ]; then
  echo "WARNING: local HEAD ($LOCAL_SHA) differs from the remote branch ($REMOTE_SHA)."
  echo "Did you forget to 'git push'? Waiting on the remote SHA if present, else local."
fi

TARGET_SHA="${REMOTE_SHA:-$LOCAL_SHA}"

elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  BUILD_JSON=$(gh api "repos/$REPO/pages/builds/latest" 2>/dev/null)
  BUILD_STATUS=$(echo "$BUILD_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{console.log(JSON.parse(d).status)}catch(e){console.log("")}})')
  BUILD_SHA=$(echo "$BUILD_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{console.log(JSON.parse(d).commit)}catch(e){console.log("")}})')
  BUILD_ERROR=$(echo "$BUILD_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);console.log((j.error&&j.error.message)||"")}catch(e){console.log("")}})')

  echo "  [${elapsed}s] latest build: sha=${BUILD_SHA:0:12} status=$BUILD_STATUS"

  if [ "$BUILD_SHA" = "$TARGET_SHA" ] && [ "$BUILD_STATUS" = "built" ]; then
    echo "OK: commit $TARGET_SHA is built and live."

    PAGES_URL=$(gh api "repos/$REPO/pages" --jq .html_url 2>/dev/null)
    if [ -n "$PAGES_URL" ]; then
      echo "Live at: $PAGES_URL"
    fi
    exit 0
  fi

  if [ -n "$BUILD_ERROR" ] && [ "$BUILD_ERROR" != "null" ]; then
    echo "ERROR: Pages build failed: $BUILD_ERROR" >&2
    exit 1
  fi

  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
done

echo "TIMEOUT: commit $TARGET_SHA was not confirmed built/live within ${MAX_WAIT}s." >&2
echo "Do not report this deploy as ready yet." >&2
exit 1
