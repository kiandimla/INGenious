#!/bin/zsh

set -euo pipefail

readonly SCRIPT_DIR="${0:A:h}"
readonly SOURCE_APP="$SCRIPT_DIR/INGenious.app"
readonly SOURCE_WORKSPACE="$SCRIPT_DIR/Workspace"

readonly APPLICATIONS_DIR="${INGENIOUS_INSTALL_APPLICATIONS_DIR:-/Applications}"
readonly USER_DATA_DIR="${INGENIOUS_INSTALL_DATA_DIR:-$HOME/Library/Application Support/INGenious}"
readonly DESTINATION_APP="$APPLICATIONS_DIR/INGenious.app"

APP_STAGE=""
APP_BACKUP=""

fail() {
  print -u2 -- ""
  print -u2 -- "ERROR: $1"
  exit 1
}

cleanup() {
  if [[ -n "$APP_STAGE" && -e "$APP_STAGE" ]]; then
    run_app_command /bin/rm -rf -- "$APP_STAGE" || true
  fi
}

trap cleanup EXIT

run_app_command() {
  if [[ -w "$APPLICATIONS_DIR" ]]; then
    command "$@"
  else
    print -- "Administrator privileges are required to update:"
    print -- "  $DESTINATION_APP"
    print -- "Only the application-copy operation will be elevated."
    /usr/bin/sudo "$@"
  fi
}

validate_sources() {
  [[ "$(uname -s)" == "Darwin" ]] ||
    fail "This installer can only run on macOS."

  [[ -d "$SOURCE_APP" ]] ||
    fail "INGenious.app was not found beside the installer: $SOURCE_APP"

  [[ -d "$SOURCE_APP/Contents" ]] ||
    fail "The source application has an invalid bundle structure."

  [[ -d "$SOURCE_WORKSPACE/Configuration" ]] ||
    fail "Workspace template is missing Configuration."

  [[ -d "$SOURCE_WORKSPACE/Projects" ]] ||
    fail "Workspace template is missing Projects."

  [[ -d "$SOURCE_WORKSPACE/Shared" ]] ||
    fail "Workspace template is missing Shared."

  [[ -d "$APPLICATIONS_DIR" ]] ||
    fail "Application destination does not exist: $APPLICATIONS_DIR"
}

install_application() {
  local unique_id
  unique_id="$$"

  APP_STAGE="$APPLICATIONS_DIR/.INGenious.app.installing.$unique_id"
  APP_BACKUP="$APPLICATIONS_DIR/.INGenious.app.backup.$unique_id"

  print -- ""
  print -- "Installing application"
  print -- "  From: $SOURCE_APP"
  print -- "  To:   $DESTINATION_APP"

  run_app_command /bin/rm -rf -- "$APP_STAGE"
  run_app_command /usr/bin/ditto "$SOURCE_APP" "$APP_STAGE"

  run_app_command /usr/bin/codesign \
    --verify \
    --deep \
    --strict \
    --verbose=2 \
    "$APP_STAGE"

  if [[ -e "$DESTINATION_APP" ]]; then
    run_app_command /bin/rm -rf -- "$APP_BACKUP"
    run_app_command /bin/mv -- "$DESTINATION_APP" "$APP_BACKUP"
  fi

  if run_app_command /bin/mv -- "$APP_STAGE" "$DESTINATION_APP"; then
    APP_STAGE=""

    if [[ -e "$APP_BACKUP" ]]; then
      run_app_command /bin/rm -rf -- "$APP_BACKUP"
    fi

    APP_BACKUP=""
  else
    print -u2 -- "Application replacement failed."

    if [[ -e "$APP_BACKUP" && ! -e "$DESTINATION_APP" ]]; then
      print -u2 -- "Restoring the previous application."
      run_app_command /bin/mv -- "$APP_BACKUP" "$DESTINATION_APP"
      APP_BACKUP=""
    fi

    fail "INGenious.app could not be installed."
  fi
}

seed_workspace() {
  local source_path
  local relative_path
  local destination_path
  local copied_count
  local preserved_count

  copied_count=0
  preserved_count=0

  print -- ""
  print -- "Preparing user data"
  print -- "  Template: $SOURCE_WORKSPACE"
  print -- "  Target:   $USER_DATA_DIR"

  /bin/mkdir -p -- "$USER_DATA_DIR"

  while IFS= read -r -d '' source_path; do
    relative_path="${source_path#$SOURCE_WORKSPACE/}"

    if [[ "$source_path" == "$SOURCE_WORKSPACE" ]]; then
      continue
    fi

    destination_path="$USER_DATA_DIR/$relative_path"

    if [[ -e "$destination_path" || -L "$destination_path" ]]; then
      if [[ -d "$destination_path" ]]; then
        continue
      fi

      print -- "Preserving existing non-directory path:"
      print -- "  $destination_path"
      preserved_count=$((preserved_count + 1))
      continue
    fi

    /bin/mkdir -p -- "$destination_path"
    copied_count=$((copied_count + 1))
  done < <(/usr/bin/find "$SOURCE_WORKSPACE" -type d -print0)

  while IFS= read -r -d '' source_path; do
    relative_path="${source_path#$SOURCE_WORKSPACE/}"
    destination_path="$USER_DATA_DIR/$relative_path"

    if [[ -e "$destination_path" || -L "$destination_path" ]]; then
      preserved_count=$((preserved_count + 1))
      continue
    fi

    /bin/mkdir -p -- "${destination_path:h}"
    /usr/bin/ditto "$source_path" "$destination_path"
    copied_count=$((copied_count + 1))
  done < <(/usr/bin/find "$SOURCE_WORKSPACE" -type f -print0)

  print -- "Workspace seeding complete."
  print -- "  Missing entries copied: $copied_count"
  print -- "  Existing entries preserved: $preserved_count"
}

print -- ""
print -- "========================================"
print -- " INGenious macOS installer"
print -- "========================================"

validate_sources
install_application
seed_workspace

print -- ""
print -- "Installation completed successfully."
print -- ""
print -- "Installed application:"
print -- "  $DESTINATION_APP"
print -- ""
print -- "User data:"
print -- "  $USER_DATA_DIR"
print -- ""
print -- "Existing user data was preserved."
print -- "The application was not launched automatically."
