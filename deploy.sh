#!/data/data/com.termux/files/usr/bin/bash

set -e

cd ~/UpTrend

echo ""
echo "=================================="
echo "       UPTREND AUTO DEPLOY"
echo "=================================="

BRANCH=$(git branch --show-current)

if [ "$BRANCH" != "main" ]; then
    echo "ERROR: You are not on main."
    exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
    echo "No new changes found."
    exit 0
fi

echo ""
echo "New changes detected:"
git status --short

echo ""
echo "Building UpTrend..."

BUILD_LOG="$HOME/uptrend-deploy-build.log"

set +e
timeout --kill-after=5s 30s node ./node_modules/vite/bin/vite.js build > "$BUILD_LOG" 2>&1
BUILD_STATUS=$?
set -e

cat "$BUILD_LOG"

if grep -qE 'built in [0-9.]+' "$BUILD_LOG" && { [ "$BUILD_STATUS" -eq 0 ] || [ "$BUILD_STATUS" -eq 124 ] || [ "$BUILD_STATUS" -eq 137 ]; }; then
    echo ""
    echo "BUILD SUCCESSFUL!"
else
    echo ""
    echo "BUILD FAILED OR TIMED OUT."
    exit 1
fi

echo ""
echo "Preparing GitHub commit..."

git add -u
git add deploy.sh

git diff --cached --check

if git diff --cached --quiet; then
    echo "No staged changes to commit."
    exit 0
fi

COMMIT_MSG="UpTrend update $(date '+%Y-%m-%d %H:%M:%S')"

git commit -m "$COMMIT_MSG"

echo ""
echo "Pushing to GitHub..."

git push origin main

echo ""
echo "=================================="
echo "   GITHUB PUSH SUCCESSFUL"
echo "=================================="
echo "Vercel automatic deployment triggered."
echo "Check Vercel for deployment status."
