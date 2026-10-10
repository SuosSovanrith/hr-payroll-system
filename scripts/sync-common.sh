#!/usr/bin/env bash
# Each service keeps its own copy of services/<name>/src/common (so every Docker image builds on its own).
# Edit the master files in shared/common/, then run:  ./scripts/sync-common.sh
# It overwrites only the files that already exist in each service's common/ folder.
set -euo pipefail
cd "$(dirname "$0")/.."
for dir in services/*/src/common; do
  for file in "$dir"/*.js; do
    cp "shared/common/$(basename "$file")" "$file"
  done
  echo "synced $dir"
done
