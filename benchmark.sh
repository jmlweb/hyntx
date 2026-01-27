#!/bin/bash
# =============================================================================
# Hyntx Model Benchmark Script
# =============================================================================

set -e

HYNTX_DIR="/Users/josemanuellucasmunoz/projects/hyntx"
OUTPUT_DIR="/Users/josemanuellucasmunoz/projects/hyntx/benchmark-results"
DATE="2026-01-02"
PROJECT="hyntx"

MODELS=(
  "llama3.2"
  "mistral:7b"
  "codellama:7b"
  "gemma3:4b"
)

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$OUTPUT_DIR/benchmark_$TIMESTAMP.json"

echo "=============================================="
echo "  Hyntx Model Benchmark"
echo "=============================================="
echo "Fecha de logs: $DATE"
echo "Proyecto: $PROJECT"
echo "Modelos: ${MODELS[*]}"
echo "Resultados: $OUTPUT_DIR"
echo "=============================================="
echo ""

cat > "$RESULTS_FILE" << EOF
{
  "benchmark_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "date_analyzed": "$DATE",
  "project": "$PROJECT",
  "system_info": {
    "hostname": "$(hostname)",
    "os": "$(uname -s)",
    "arch": "$(uname -m)"
  },
  "results": [
EOF

cd "$HYNTX_DIR"

FIRST=true
for MODEL in "${MODELS[@]}"; do
  echo ""
  echo "----------------------------------------------"
  echo "Testing model: $MODEL"
  echo "----------------------------------------------"
  
  MODEL_SAFE=$(echo "$MODEL" | tr ":" "-")
  OUTPUT_JSON="$OUTPUT_DIR/result_${MODEL_SAFE}_$TIMESTAMP.json"
  
  START_TIME=$(gdate +%s.%N 2>/dev/null || date +%s)
  
  echo "Running hyntx..."
  HYNTX_SERVICES=ollama \
  HYNTX_OLLAMA_MODEL="$MODEL" \
  HYNTX_REMINDER=never \
  node dist/cli.js \
    --date "$DATE" \
    --project "$PROJECT" \
    --no-cache \
    --output "$OUTPUT_JSON" \
    2>&1 | tee "$OUTPUT_DIR/log_${MODEL_SAFE}_$TIMESTAMP.txt" || true
  
  END_TIME=$(gdate +%s.%N 2>/dev/null || date +%s)
  DURATION=$(echo "$END_TIME - $START_TIME" | bc 2>/dev/null || echo "0")
  
  echo "Duration: ${DURATION}s"
  
  if [ -f "$OUTPUT_JSON" ]; then
    PROMPTS=$(jq -r '.stats.totalPrompts // 0' "$OUTPUT_JSON" 2>/dev/null || echo "0")
    SCORE=$(jq -r '.stats.overallScore // 0' "$OUTPUT_JSON" 2>/dev/null || echo "0")
    PATTERNS=$(jq -r '.patterns | length' "$OUTPUT_JSON" 2>/dev/null || echo "0")
    TOP_SUGGESTION=$(jq -r '.topSuggestion // "N/A"' "$OUTPUT_JSON" 2>/dev/null || echo "N/A")
    STATUS="success"
  else
    PROMPTS=0
    SCORE=0
    PATTERNS=0
    TOP_SUGGESTION="N/A"
    STATUS="failed"
  fi
  
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> "$RESULTS_FILE"
  fi
  
  cat >> "$RESULTS_FILE" << ENTRY
    {
      "model": "$MODEL",
      "status": "$STATUS",
      "duration_seconds": $DURATION,
      "metrics": {
        "total_prompts": $PROMPTS,
        "overall_score": $SCORE,
        "patterns_detected": $PATTERNS
      },
      "top_suggestion": $(echo "$TOP_SUGGESTION" | jq -R .)
    }
ENTRY

  echo "✓ Model $MODEL completed (${DURATION}s, score: $SCORE)"
done

cat >> "$RESULTS_FILE" << EOF
  ]
}
EOF

echo ""
echo "=============================================="
echo "  Benchmark Complete!"
echo "=============================================="
echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
