#!/bin/zsh

set -euo pipefail

readonly SCRIPT_DIR="${0:A:h}"
readonly REPO_ROOT="${SCRIPT_DIR:h}"

fail() {
  print -u2 -- "ERROR: $1"
  exit 1
}

[[ "$(uname -s)" == "Darwin" ]] ||
  fail "The macOS app-image can only be built on macOS"

JAVA_HOME="$(/usr/libexec/java_home -v 17)" ||
  fail "A Java 17 JDK could not be located"

readonly JAVA_HOME
export JAVA_HOME

PATH="$JAVA_HOME/bin:$PATH"
readonly PATH
export PATH

[[ -x "$JAVA_HOME/bin/java" ]] ||
  fail "Java 17 is missing or not executable: $JAVA_HOME/bin/java"

command -v mvn >/dev/null 2>&1 ||
  fail "Maven could not be found after selecting Java 17"

cd "$REPO_ROOT"

print -- "Using Java:"
"$JAVA_HOME/bin/java" -version
print -- ""

exec mvn clean install -Pmacos
