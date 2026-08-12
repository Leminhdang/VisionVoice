#!/bin/bash
# Quick session capture helper for AI agents
# Usage: bash memory/capture.sh "<agent>" "<task>" "<files>" "<status>"
set -euo pipefail
AGENT="${1:-Unknown}"
TASK="${2:-Untitled task}"
FILES="${3:-none}"
STATUS="${4:-completed}"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
MEMORY_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTEXT_FILE="$MEMORY_DIR/context.md"
COMPACT_FILE="$MEMORY_DIR/COMPACT.md"

# Cross-platform sed -i
sedi() {
  if [[ "$OSTYPE" == "darwin"* ]]; then sed -i '' "$@"; else sed -i "$@"; fi
}

if [ -f "$CONTEXT_FILE" ]; then
  if grep -q "## Session Log" "$CONTEXT_FILE"; then
    ENTRY="\n### [$TIMESTAMP] Agent: $AGENT | Task: $TASK\n- Files: $FILES\n- Status: $STATUS"
    TMPFILE=$(mktemp)
    awk -v entry="$ENTRY" '/## Session Log/{print; print entry; next}1' "$CONTEXT_FILE" > "$TMPFILE"
    mv "$TMPFILE" "$CONTEXT_FILE"
  else
    cat >> "$CONTEXT_FILE" << EOF

## Session Log (last 5 sessions)

### [$TIMESTAMP] Agent: $AGENT | Task: $TASK
- Files: $FILES
- Status: $STATUS
EOF
  fi
fi

if [ -f "$COMPACT_FILE" ]; then
  sedi "s|^\[.*\] .*: .*|[$TIMESTAMP] $AGENT: $TASK|" "$COMPACT_FILE"
fi
echo "✅ Session captured: $AGENT | $TASK | $STATUS"
