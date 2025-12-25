#!/bin/bash
# suggest-ideas.sh - Execute multiple /suggest-idea commands with auto-accept
#
# Usage: ./suggest-ideas.sh [MAX_IDEAS] [DELAY] [TASK_TIMEOUT]
#   MAX_IDEAS: Maximum number of ideas to suggest (default: 3)
#   DELAY: Delay in seconds between ideas (default: 2)
#   TASK_TIMEOUT: Timeout in seconds for each idea (default: 1800 = 30 minutes)

# Don't use set -e so we can handle errors ourselves
# set -e

# Validate inputs
MAX_IDEAS=${1:-3}
DELAY=${2:-2}
TASK_TIMEOUT=${3:-1800}  # Default: 30 minutes (1800 seconds)

# Validate MAX_IDEAS is a positive integer
if ! [[ "$MAX_IDEAS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: MAX_IDEAS must be a positive integer (got: $MAX_IDEAS)" >&2
  exit 1
fi

# Validate DELAY is a non-negative number
if ! [[ "$DELAY" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Error: DELAY must be a non-negative number (got: $DELAY)" >&2
  exit 1
fi

# Validate TASK_TIMEOUT is a positive integer
if ! [[ "$TASK_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: TASK_TIMEOUT must be a positive integer in seconds (got: $TASK_TIMEOUT)" >&2
  exit 1
fi

# Check if claude command exists
if ! command -v claude &> /dev/null; then
  echo "Error: 'claude' command not found in PATH" >&2
  echo "Please ensure Claude Code CLI is installed and available in your PATH" >&2
  exit 1
fi

# Verify we're in the project directory (check for AGENTS.md)
if [ ! -f "AGENTS.md" ]; then
  echo "Warning: AGENTS.md not found. Make sure you're running this script from the project root." >&2
  echo "Current directory: $(pwd)" >&2
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Function to execute command with timeout
# Uses 'timeout' command if available, otherwise implements manual timeout
execute_with_timeout() {
  local timeout_seconds=$1
  shift
  local cmd=("$@")

  # Try to find timeout command (timeout or gtimeout on macOS)
  local timeout_cmd=""
  if command -v timeout &> /dev/null; then
    timeout_cmd="timeout"
  elif command -v gtimeout &> /dev/null; then
    timeout_cmd="gtimeout"
  fi

  if [ -n "$timeout_cmd" ]; then
    # Use system timeout command
    "$timeout_cmd" "$timeout_seconds" "${cmd[@]}"
    return $?
  else
    # Manual timeout implementation using background process
    "${cmd[@]}" &
    local cmd_pid=$!
    local elapsed=0
    local check_interval=1

    while kill -0 $cmd_pid 2>/dev/null; do
      sleep $check_interval
      elapsed=$((elapsed + check_interval))

      if [ $elapsed -ge $timeout_seconds ]; then
        echo "" >&2
        echo "⏱️  Timeout reached (${timeout_seconds}s). Terminating task..." >&2
        kill -TERM $cmd_pid 2>/dev/null
        sleep 2
        # Force kill if still running
        if kill -0 $cmd_pid 2>/dev/null; then
          kill -KILL $cmd_pid 2>/dev/null
        fi
        wait $cmd_pid 2>/dev/null
        return 124  # Exit code 124 indicates timeout (matches GNU timeout)
      fi
    done

    wait $cmd_pid
    return $?
  fi
}

echo "========================================"
echo "  Automated Idea Suggestion"
echo "========================================"
echo "Max ideas: $MAX_IDEAS"
echo "Delay between ideas: ${DELAY}s"
echo "Task timeout: ${TASK_TIMEOUT}s ($(($TASK_TIMEOUT / 60)) minutes)"
echo "Working directory: $(pwd)"
echo "Claude command: $(command -v claude)"

echo "----------------------------------------"

# Pull latest changes at start (fail script if pull fails)
echo ""
echo "🔄 Pulling latest changes from remote repository..."
if command -v git &> /dev/null; then
  echo "Executing: git pull --rebase"
  git pull --rebase
  PULL_EXIT_CODE=$?
  if [ $PULL_EXIT_CODE -ne 0 ]; then
    echo "❌ Error: git pull --rebase failed (exit code: $PULL_EXIT_CODE)" >&2
    echo "Aborting script execution." >&2
    exit $PULL_EXIT_CODE
  else
    echo "✓ Successfully pulled latest changes"
  fi
else
  echo "❌ Error: 'git' command not found. Cannot proceed without git." >&2
  exit 1
fi

echo "----------------------------------------"

COMPLETED=0

for i in $(seq 1 $MAX_IDEAS); do
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  Idea $i of $MAX_IDEAS"
  echo "║  Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "╚══════════════════════════════════════╝"
  echo ""

  # Execute claude in non-interactive mode with /suggest-idea
  echo "Executing: claude -p \"/suggest-idea\" (timeout: ${TASK_TIMEOUT}s)"
  echo ""  # Blank line before claude output

  # Execute claude with timeout
  execute_with_timeout $TASK_TIMEOUT claude -p "/suggest-idea" 2>&1
  EXIT_CODE=$?

  echo ""  # Blank line after claude output

  # Handle timeout exit code (124 is standard for timeout command)
  if [ $EXIT_CODE -eq 124 ]; then
    echo ""
    echo "⏱️  Idea $i timed out after ${TASK_TIMEOUT}s"
    echo "Breaking execution loop..."
    break
  fi

  if [ $EXIT_CODE -eq 0 ]; then
    COMPLETED=$((COMPLETED + 1))
    echo ""
    echo "✓ Idea $i completed successfully (exit code: $EXIT_CODE)"

    # Sync with remote repository
    echo ""
    echo "🔄 Syncing with remote repository..."

    # Pull latest changes (using git pull --rebase)
    if command -v git &> /dev/null; then
      echo "Executing: git pull --rebase"
      git pull --rebase
      PULL_EXIT_CODE=$?
      if [ $PULL_EXIT_CODE -ne 0 ]; then
        echo "⚠️  Warning: git pull --rebase failed (exit code: $PULL_EXIT_CODE)" >&2
      fi
    else
      echo "⚠️  Warning: 'git' command not found, skipping pull" >&2
    fi

    # Push local changes
    if command -v git &> /dev/null; then
      echo "Executing: git push"
      git push
      PUSH_EXIT_CODE=$?
      if [ $PUSH_EXIT_CODE -ne 0 ]; then
        echo "⚠️  Warning: git push failed (exit code: $PUSH_EXIT_CODE)" >&2
      fi
    else
      echo "⚠️  Warning: 'git' command not found, skipping push" >&2
    fi
  else
    echo ""
    echo "✗ Idea $i failed (exit code: $EXIT_CODE)"
    echo "Breaking execution loop..."
    break
  fi

  # Delay before next idea (skip on last iteration)
  if [ $i -lt $MAX_IDEAS ]; then
    echo ""
    echo "⏳ Waiting ${DELAY}s before next idea..."
    sleep $DELAY
  fi
done

echo ""
echo "========================================"
echo "  Execution Complete"
echo "========================================"
echo "Ideas completed: $COMPLETED of $MAX_IDEAS requested"
echo "Finished at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
