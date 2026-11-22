#!/usr/bin/env bash
# Make the Lines & Logos GitHub repo PRIVATE after the final push.
# Run ONCE from the repo root, after everything is committed and pushed.
#
# Usage:  ./scripts/github-private.sh [owner/repo]   (defaults to origin remote)
set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ]; then
  REPO=$(git remote get-url origin 2>/dev/null | sed -E 's#.*github\.com[:/]##; s#\.git$##')
fi
if [ -z "$REPO" ]; then echo "Could not determine repo — pass owner/repo as an argument."; exit 1; fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required:  https://cli.github.com  — install, then run: gh auth login"
  exit 1
fi

echo "Setting $REPO to private…"
gh api "repos/$REPO" -X PATCH -F private=true --jq '.full_name + " → private: " + (.private|tostring)'

echo ""
echo "✅ Done. Access rules now in effect:"
echo "  • Only you + collaborators you invite can see the code, issues, and wiki"
echo "  • Anonymous git clone, star, and fork are disabled"
echo "  • GitHub Actions still run (private repos: 2,000 free minutes/mo)"
echo ""
if gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  echo "⚠️  WARNING: this repo has GitHub Pages enabled. A PRIVATE repo makes its Pages site private too"
  echo "   (viewers must log in + have access). If the public website is served from GitHub Pages,"
  echo "   move hosting to the VPS BEFORE/AS you flip this switch — see pkg/ deployment scripts."
fi
