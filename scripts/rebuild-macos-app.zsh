#!/bin/zsh

set -euo pipefail

readonly SCRIPT_DIR="${0:A:h}"
readonly REPO_ROOT="${SCRIPT_DIR:h}"

cd "$REPO_ROOT"

exec mvn clean install -Pmacos
