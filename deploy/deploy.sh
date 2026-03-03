#!/bin/bash

set -euo pipefail

[ -z "${HOME:-}" ] && export HOME="/home/ubuntu"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEPS_DIR="$SCRIPT_DIR/steps"
LOG_DIR="${HOME}/logs"
LOG_FILE="${LOG_DIR}/web_deployment_$(date +%Y%m%d_%H%M%S).log"

show_help() {
  cat << EOF_HELP
ZeroGEX Web Deployment

Usage: ./deploy.sh [OPTIONS]

Options:
  --start-from STEP   Start deployment from a step prefix (e.g. 020, nodejs, nginx)
  -h, --help          Show help
EOF_HELP
  exit 0
}

START_FROM=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-from) START_FROM="${2:-}"; shift 2 ;;
    -h|--help) show_help ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
export -f log
export LOG_FILE

log "🚀 Deploying ZeroGEX Web"
[[ -n "$START_FROM" ]] && log "Starting from step: $START_FROM"

mapfile -t STEP_SCRIPTS < <(find "$STEPS_DIR" -maxdepth 1 -type f | sort)

SHOULD_EXECUTE=false
[[ -z "$START_FROM" ]] && SHOULD_EXECUTE=true

for step_script in "${STEP_SCRIPTS[@]}"; do
  [[ ! -x "$step_script" ]] && continue
  step_name="$(basename "$step_script")"

  if [[ -n "$START_FROM" && "$step_name" == *"$START_FROM"* ]]; then
    SHOULD_EXECUTE=true
    log "Found start step: $step_name"
  fi

  if [[ "$SHOULD_EXECUTE" == false ]]; then
    log "Skipping: $step_name"
    continue
  fi

  log "=========================================="
  log "Executing: $step_name"
  bash "$step_script"
  log "✓ $step_name completed"
done

log "✅ Deployment Complete"
log "Log file: $LOG_FILE"
