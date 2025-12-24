#!/bin/bash
# next-tasks.sh - Execute multiple /next-task commands with clean context between each

# Don't use set -e so we can handle errors ourselves
# set -e

MAX_TASKS=${1:-5}
DELAY=${2:-2}

echo "========================================"
echo "  Automated Task Execution"
echo "========================================"
echo "Max tasks: $MAX_TASKS"
echo "Delay between tasks: ${DELAY}s"
echo "Working directory: $(pwd)"
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
  claude -p "/next-task"
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    COMPLETED=$((COMPLETED + 1))
    echo ""
    echo "✓ Task $i completed successfully (exit code: $EXIT_CODE)"
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
