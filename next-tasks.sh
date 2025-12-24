#!/bin/bash
# next-tasks.sh - Execute multiple /next-task commands with clean context between each

# Don't use set -e so we can handle errors ourselves
# set -e

# Validate inputs
MAX_TASKS=${1:-10}
DELAY=${2:-2}

# Validate MAX_TASKS is a positive integer
if ! [[ "$MAX_TASKS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: MAX_TASKS must be a positive integer (got: $MAX_TASKS)" >&2
  exit 1
fi

# Validate DELAY is a non-negative number
if ! [[ "$DELAY" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Error: DELAY must be a non-negative number (got: $DELAY)" >&2
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

echo "========================================"
echo "  Automated Task Execution"
echo "========================================"
echo "Max tasks: $MAX_TASKS"
echo "Delay between tasks: ${DELAY}s"
echo "Working directory: $(pwd)"
echo "Claude command: $(command -v claude)"

echo "----------------------------------------"

COMPLETED=0

for i in $(seq 1 $MAX_TASKS); do
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  Task $i of $MAX_TASKS"
  echo "║  Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "╚══════════════════════════════════════╝"
  echo ""

  # Execute claude in non-interactive mode with /next-task
  # Output directly to terminal (not captured) for real-time display
  echo "Executing: claude -p \"/next-task\""
  echo ""  # Blank line before claude output
  
  # Execute claude directly - the CLI handles its own output buffering
  # Using --output-format stream-json would give structured output but we want human-readable
  claude -p "/next-task" 2>&1
  EXIT_CODE=$?
  
  echo ""  # Blank line after claude output

  if [ $EXIT_CODE -eq 0 ]; then
    COMPLETED=$((COMPLETED + 1))
    echo ""
    echo "✓ Task $i completed successfully (exit code: $EXIT_CODE)"
    
    # Sync with remote repository
    echo ""
    echo "🔄 Syncing with remote repository..."
    
    # Pull latest changes
    if command -v ggpull &> /dev/null; then
      echo "Executing: ggpull"
      ggpull
      PULL_EXIT_CODE=$?
      if [ $PULL_EXIT_CODE -ne 0 ]; then
        echo "⚠️  Warning: ggpull failed (exit code: $PULL_EXIT_CODE)" >&2
      fi
    else
      echo "⚠️  Warning: 'ggpull' command not found, skipping pull" >&2
    fi
    
    # Push local changes
    if command -v ggpush &> /dev/null; then
      echo "Executing: ggpush"
      ggpush
      PUSH_EXIT_CODE=$?
      if [ $PUSH_EXIT_CODE -ne 0 ]; then
        echo "⚠️  Warning: ggpush failed (exit code: $PUSH_EXIT_CODE)" >&2
      fi
    else
      echo "⚠️  Warning: 'ggpush' command not found, skipping push" >&2
    fi
  else
    echo ""
    echo "✗ Task $i failed (exit code: $EXIT_CODE)"
    echo "Breaking execution loop..."
    break
  fi

  # Delay before next task (skip on last iteration)
  if [ $i -lt $MAX_TASKS ]; then
    echo ""
    echo "⏳ Waiting ${DELAY}s before next task..."
    sleep $DELAY
  fi
done

echo ""
echo "========================================"
echo "  Execution Complete"
echo "========================================"
echo "Tasks completed: $COMPLETED of $MAX_TASKS requested"
echo "Finished at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
