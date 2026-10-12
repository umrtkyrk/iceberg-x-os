#!/usr/bin/env bash
#
# Keeps the two repositories identical.
#
#   deploy  git@github.com:yemrealtanay/iceberg-x-os.git        (production deploys from its main)
#   org     git@github.com:Iceberg-Digital-Team/iceberg-x-os.git
#
# The failure this prevents: merging the same PR separately in each repository
# creates two different merge commits, the histories drift apart, and a later
# "merge main into branch" produced a broken Layout.tsx that failed the deploy.
#
# Usage:
#   scripts/sync-remotes.sh            # report only (default)
#   scripts/sync-remotes.sh --apply    # fast-forward whichever repo is behind
#   scripts/sync-remotes.sh dev --apply   # another branch
#
# It only ever fast-forwards. It never force-pushes and never merges for you.
# If the two have diverged it stops and prints how to reconcile them.
#
# Override the URLs for testing with DEPLOY_URL / ORG_URL.
set -euo pipefail

DEPLOY_URL="${DEPLOY_URL:-git@github.com:yemrealtanay/iceberg-x-os.git}"
ORG_URL="${ORG_URL:-git@github.com:Iceberg-Digital-Team/iceberg-x-os.git}"

BRANCH="main"
APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) BRANCH="$arg" ;;
  esac
done

git fetch -q "$DEPLOY_URL" "+refs/heads/$BRANCH:refs/remotes/sync-deploy/$BRANCH"
git fetch -q "$ORG_URL" "+refs/heads/$BRANCH:refs/remotes/sync-org/$BRANCH"

D=$(git rev-parse "refs/remotes/sync-deploy/$BRANCH")
O=$(git rev-parse "refs/remotes/sync-org/$BRANCH")
short() { git rev-parse --short "$1"; }

echo "deploy ($BRANCH): $(short "$D")  $(git log -1 --format=%s "$D" | cut -c1-70)"
echo "org    ($BRANCH): $(short "$O")  $(git log -1 --format=%s "$O" | cut -c1-70)"

if [ "$D" = "$O" ]; then
  echo "In sync."
  exit 0
fi

if git merge-base --is-ancestor "$O" "$D"; then
  n=$(git rev-list --count "$O..$D")
  echo "org is behind deploy by $n commit(s)."
  if [ "$APPLY" = 1 ]; then
    git push "$ORG_URL" "$D:refs/heads/$BRANCH"
    echo "org fast-forwarded to $(short "$D")."
  else
    echo "Run with --apply to fast-forward org."
  fi
  exit 0
fi

if git merge-base --is-ancestor "$D" "$O"; then
  n=$(git rev-list --count "$D..$O")
  echo "deploy is behind org by $n commit(s)."
  echo "NOTE: pushing to deploy triggers a production deploy."
  if [ "$APPLY" = 1 ]; then
    git push "$DEPLOY_URL" "$O:refs/heads/$BRANCH"
    echo "deploy fast-forwarded to $(short "$O")."
  else
    echo "Run with --apply to fast-forward deploy."
  fi
  exit 0
fi

echo "DIVERGED: neither repository contains the other. Nothing was changed."
echo "  only on deploy: $(git rev-list --count "$O..$D") commit(s)"
echo "  only on org:    $(git rev-list --count "$D..$O") commit(s)"
echo
echo "Reconcile once, then both can fast-forward to the same commit:"
echo "  git worktree add ../sync-merge refs/remotes/sync-deploy/$BRANCH"
echo "  cd ../sync-merge && git merge refs/remotes/sync-org/$BRANCH"
echo "  # resolve conflicts, run: (cd frontend && npm run build)"
echo "  git push $DEPLOY_URL HEAD:refs/heads/$BRANCH && git push $ORG_URL HEAD:refs/heads/$BRANCH"
exit 2
