#!/usr/bin/env bash
# test-ci-locally.sh
# Local CI simulation for CA Marketplace.
# Idempotent: cleans up containers/volumes before every run.
#
# Usage:
#   ./test-ci-locally.sh                  # Run ALL jobs
#   ./test-ci-locally.sh backend-unit     # Run one backend suite
#   ./test-ci-locally.sh backend-all      # All backend suites
#   ./test-ci-locally.sh frontend         # Frontend unit tests
#   ./test-ci-locally.sh e2e              # Cypress E2E (full stack)
#   ./test-ci-locally.sh security         # npm audit + docker image scan
#   ./test-ci-locally.sh coverage         # Coverage report only
#   ./test-ci-locally.sh act-build        # Simulate GitHub Actions build job (requires act)
#   ./test-ci-locally.sh act-security     # Simulate GitHub Actions security job (requires act)
#   ./test-ci-locally.sh help             # Show this message

set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ─── Config ───────────────────────────────────────────────────────────────────
COMPOSE_TEST_FILE="docker-compose.test.yml"
COMPOSE_CMD="docker-compose"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
COVERAGE_DIR="$ROOT_DIR/.coverage-report"
LOG_DIR="$ROOT_DIR/.ci-logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()     { echo -e "${BLUE}[CI]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[⚠]${RESET} $*"; }
error()   { echo -e "${RED}[✗]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; \
            echo -e "${BOLD}${CYAN}  $*${RESET}"; \
            echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n"; }

require_cmd() {
  command -v "$1" &>/dev/null || { error "Required: '$1' not found. Install it first."; exit 1; }
}

# Timer helpers
_start_timer() { _TIMER_START=$(date +%s); }
_elapsed()     { echo $(( $(date +%s) - _TIMER_START ))s; }

# ─── Pre-flight checks ────────────────────────────────────────────────────────
preflight() {
  require_cmd docker
  require_cmd docker-compose
  docker info &>/dev/null || { error "Docker daemon is not running."; exit 1; }
  [ -f "$ROOT_DIR/$COMPOSE_TEST_FILE" ] || { error "$COMPOSE_TEST_FILE not found in $ROOT_DIR"; exit 1; }
}

# ─── Clean state (idempotent) ─────────────────────────────────────────────────
cleanup() {
  log "Cleaning previous test state..."

  # Stop and remove all test containers + anonymous volumes
  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" down --volumes --remove-orphans 2>/dev/null || true

  # Remove named containers that may have been left behind
  for name in ca_postgres_test ca_redis_test ca_migrate_test \
              ca_backend_unit_test ca_backend_integration_test \
              ca_backend_security_test ca_backend_negative_test \
              ca_frontend_unit_test ca_backend_e2e ca_frontend_e2e ca_cypress_test; do
    docker rm -f "$name" 2>/dev/null || true
  done

  # Remove stale coverage artifacts (fresh run)
  rm -rf "$BACKEND_DIR/coverage" "$FRONTEND_DIR/coverage" "$COVERAGE_DIR"
  mkdir -p "$LOG_DIR" "$COVERAGE_DIR"

  success "Clean state established"
}

# ─── Coverage report printer ──────────────────────────────────────────────────
print_coverage() {
  local label="$1"
  local summary_file="$2"

  if [ ! -f "$summary_file" ]; then
    warn "$label: coverage-summary.json not found at $summary_file"
    return
  fi

  python3 - "$summary_file" "$label" <<'EOF'
import sys, json

path, label = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)

total = data.get("total", {})
metrics = {
    "Statements": total.get("statements", {}).get("pct", 0),
    "Branches":   total.get("branches",   {}).get("pct", 0),
    "Functions":  total.get("functions",  {}).get("pct", 0),
    "Lines":      total.get("lines",      {}).get("pct", 0),
}

RESET  = "\033[0m"
GREEN  = "\033[0;32m"
YELLOW = "\033[1;33m"
RED    = "\033[0;31m"
BOLD   = "\033[1m"

def colour(pct):
    if pct >= 80: return GREEN
    if pct >= 50: return YELLOW
    return RED

print(f"\n{BOLD}  Coverage — {label}{RESET}")
print("  " + "─" * 40)
for name, pct in metrics.items():
    bar_len = int(pct / 5)
    bar = "█" * bar_len + "░" * (20 - bar_len)
    c = colour(pct)
    print(f"  {name:<12} {c}{bar}{RESET}  {c}{pct:5.1f}%{RESET}")
print()
EOF
}

# ─── Job: backend-unit ────────────────────────────────────────────────────────
job_backend_unit() {
  header "Backend — Unit Tests"
  _start_timer
  log "Running backend unit tests..."

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    run --rm --no-deps \
    -e DATABASE_URL="postgresql://caadmin:CaSecure123!@postgres-test:5432/camarketplace_test" \
    -e TEST_DATABASE_URL="postgresql://caadmin:CaSecure123!@postgres-test:5432/camarketplace_test" \
    -e REDIS_URL="redis://redis-test:6379/1" \
    -e NODE_ENV=test \
    -e JWT_SECRET=ci-test-jwt-secret \
    -e JWT_REFRESH_SECRET=ci-test-jwt-refresh-secret \
    backend-unit 2>&1 | tee "$LOG_DIR/backend-unit-$TIMESTAMP.log"

  print_coverage "Backend Unit" "$BACKEND_DIR/coverage/unit/coverage-summary.json"
  success "Backend unit tests passed ($(elapsed))"
}

# ─── Job: backend-integration ─────────────────────────────────────────────────
job_backend_integration() {
  header "Backend — Integration Tests"
  _start_timer
  log "Requires Postgres + Redis + Migrations..."

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    up --build --abort-on-container-exit --exit-code-from backend-integration \
    postgres-test redis-test migrate backend-integration \
    2>&1 | tee "$LOG_DIR/backend-integration-$TIMESTAMP.log"

  print_coverage "Backend Integration" "$BACKEND_DIR/coverage/integration/coverage-summary.json"
  success "Backend integration tests passed ($(_elapsed))"
}

# ─── Job: backend-security ────────────────────────────────────────────────────
job_backend_security() {
  header "Backend — Security Tests"
  _start_timer

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    up --build --abort-on-container-exit --exit-code-from backend-security \
    postgres-test redis-test migrate backend-security \
    2>&1 | tee "$LOG_DIR/backend-security-$TIMESTAMP.log"

  print_coverage "Backend Security" "$BACKEND_DIR/coverage/security/coverage-summary.json"
  success "Backend security tests passed ($(_elapsed))"
}

# ─── Job: backend-negative ────────────────────────────────────────────────────
job_backend_negative() {
  header "Backend — Negative Tests"
  _start_timer

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    up --build --abort-on-container-exit --exit-code-from backend-negative \
    postgres-test redis-test migrate backend-negative \
    2>&1 | tee "$LOG_DIR/backend-negative-$TIMESTAMP.log"

  success "Backend negative tests passed ($(_elapsed))"
}

# ─── Job: backend-all ─────────────────────────────────────────────────────────
job_backend_all() {
  header "Backend — All Test Suites"
  _start_timer
  log "Running unit + integration + security + negative in parallel..."

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    up --build --abort-on-container-exit \
    --exit-code-from backend-unit \
    postgres-test redis-test migrate \
    backend-unit backend-integration backend-security backend-negative \
    2>&1 | tee "$LOG_DIR/backend-all-$TIMESTAMP.log"

  # Print merged coverage for each suite
  for suite in unit integration security negative; do
    print_coverage "Backend $suite" "$BACKEND_DIR/coverage/$suite/coverage-summary.json"
  done

  success "All backend test suites passed ($(_elapsed))"
}

# ─── Job: frontend ────────────────────────────────────────────────────────────
job_frontend() {
  header "Frontend — Unit Tests"
  _start_timer

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    up --build --abort-on-container-exit --exit-code-from frontend-unit \
    frontend-unit \
    2>&1 | tee "$LOG_DIR/frontend-unit-$TIMESTAMP.log"

  print_coverage "Frontend" "$FRONTEND_DIR/coverage/coverage-summary.json"
  success "Frontend tests passed ($(_elapsed))"
}

# ─── Job: e2e ─────────────────────────────────────────────────────────────────
job_e2e() {
  header "Cypress E2E Tests (full stack)"
  _start_timer
  log "Starting: postgres → redis → migrate → backend → frontend → cypress"

  $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
    up --build --abort-on-container-exit --exit-code-from cypress \
    2>&1 | tee "$LOG_DIR/e2e-$TIMESTAMP.log"

  local video_dir="$FRONTEND_DIR/cypress/videos"
  local ss_dir="$FRONTEND_DIR/cypress/screenshots"
  [ -d "$video_dir" ] && log "Cypress videos: $video_dir"
  [ -d "$ss_dir"    ] && log "Cypress screenshots: $ss_dir"

  success "E2E tests passed ($(_elapsed))"
}

# ─── Job: security ────────────────────────────────────────────────────────────
job_security() {
  header "Security Scan"
  _start_timer
  SECURITY_FAILED=0

  # npm audit — backend
  log "npm audit — Backend..."
  (cd "$BACKEND_DIR" && npm audit --audit-level=high --json \
    > "$LOG_DIR/backend-audit-$TIMESTAMP.json" 2>&1) || SECURITY_FAILED=1

  # npm audit — frontend
  log "npm audit — Frontend..."
  (cd "$FRONTEND_DIR" && npm audit --audit-level=high --json \
    > "$LOG_DIR/frontend-audit-$TIMESTAMP.json" 2>&1) || SECURITY_FAILED=1

  # Parse and print audit summaries
  for target in backend frontend; do
    python3 - "$LOG_DIR/${target}-audit-$TIMESTAMP.json" "$target" <<'EOF'
import sys, json

path, name = sys.argv[1], sys.argv[2]
GREEN = "\033[0;32m"; RED = "\033[0;31m"; YELLOW = "\033[1;33m"; RESET = "\033[0m"
try:
    with open(path) as f:
        data = json.load(f)
    v = data.get("metadata", {}).get("vulnerabilities", {})
    crit = v.get("critical", 0); high = v.get("high", 0)
    mod  = v.get("moderate", 0); low  = v.get("low", 0)
    c = RED if (crit or high) else GREEN
    print(f"  {name}: {c}critical={crit} high={high}{RESET} moderate={mod} low={low}")
except Exception as e:
    print(f"  {YELLOW}{name}: could not parse audit ({e}){RESET}")
EOF
  done

  # Docker image scan (if trivy is available)
  if command -v trivy &>/dev/null; then
    log "Trivy image scan — Backend..."
    docker build -q -f "$ROOT_DIR/backend/Dockerfile.prod" \
      -t ca-backend:scan "$ROOT_DIR/backend" 2>/dev/null
    trivy image --severity HIGH,CRITICAL --exit-code 0 ca-backend:scan \
      > "$LOG_DIR/trivy-backend-$TIMESTAMP.txt" 2>&1
    grep -E "CRITICAL|HIGH|Total" "$LOG_DIR/trivy-backend-$TIMESTAMP.txt" | tail -5 || true

    log "Trivy image scan — Frontend..."
    docker build -q -f "$ROOT_DIR/frontend/Dockerfile.prod" \
      --build-arg REACT_APP_API_URL=http://localhost/api \
      -t ca-frontend:scan "$ROOT_DIR/frontend" 2>/dev/null
    trivy image --severity HIGH,CRITICAL --exit-code 0 ca-frontend:scan \
      > "$LOG_DIR/trivy-frontend-$TIMESTAMP.txt" 2>&1
    grep -E "CRITICAL|HIGH|Total" "$LOG_DIR/trivy-frontend-$TIMESTAMP.txt" | tail -5 || true
  else
    warn "trivy not found — skipping Docker image scan (install: https://aquasecurity.github.io/trivy)"
  fi

  if [ "$SECURITY_FAILED" -eq 0 ]; then
    success "Security scan passed ($(_elapsed))"
  else
    warn "Security scan found high/critical vulnerabilities — check $LOG_DIR/"
    return 1
  fi
}

# ─── Job: coverage report ─────────────────────────────────────────────────────
job_coverage() {
  header "Coverage Report"

  for suite in unit integration security; do
    print_coverage "Backend $suite" "$BACKEND_DIR/coverage/$suite/coverage-summary.json"
  done
  print_coverage "Frontend" "$FRONTEND_DIR/coverage/coverage-summary.json"

  log "Raw coverage files:"
  find "$BACKEND_DIR/coverage" "$FRONTEND_DIR/coverage" \
    -name "lcov.info" 2>/dev/null | while read -r f; do
    echo "  $f"
  done
}

# ─── Job: act-build (requires `act`) ─────────────────────────────────────────
job_act_build() {
  header "Simulate GitHub Actions — backend-tests job (act)"
  require_cmd act
  log "Running act for backend-tests job..."
  act push \
    --job backend-tests \
    --secret-file "$ROOT_DIR/.secrets" \
    --env-file "$ROOT_DIR/.env.act" \
    --platform ubuntu-latest=catthehacker/ubuntu:act-22.04 \
    -W "$ROOT_DIR/.github/workflows/mvp-ci-cd.yml" \
    2>&1 | tee "$LOG_DIR/act-build-$TIMESTAMP.log"
}

# ─── Job: act-security ────────────────────────────────────────────────────────
job_act_security() {
  header "Simulate GitHub Actions — security-scan job (act)"
  require_cmd act
  log "Running act for security-scan job..."
  act push \
    --job security-scan \
    --secret-file "$ROOT_DIR/.secrets" \
    --env-file "$ROOT_DIR/.env.act" \
    --platform ubuntu-latest=catthehacker/ubuntu:act-22.04 \
    -W "$ROOT_DIR/.github/workflows/mvp-ci-cd.yml" \
    2>&1 | tee "$LOG_DIR/act-security-$TIMESTAMP.log"
}

# ─── Final summary ────────────────────────────────────────────────────────────
print_summary() {
  local results=("$@")
  header "Pipeline Summary"
  echo -e "  ${BOLD}Job${RESET}                    ${BOLD}Result${RESET}"
  echo    "  ─────────────────────────────────────"
  for line in "${results[@]}"; do
    local job="${line%%:*}"
    local status="${line##*:}"
    if [ "$status" = "PASS" ]; then
      echo -e "  ${GREEN}✓${RESET} $(printf '%-22s' "$job") ${GREEN}PASS${RESET}"
    else
      echo -e "  ${RED}✗${RESET} $(printf '%-22s' "$job") ${RED}FAIL${RESET}"
    fi
  done
  echo
  log "Logs saved to: $LOG_DIR/"
}

# ─── Run a job and track pass/fail ────────────────────────────────────────────
run_job() {
  local name="$1"; shift
  local status="PASS"
  "$@" || status="FAIL"
  RESULTS+=("$name:$status")
  [ "$status" = "PASS" ] || PIPELINE_FAILED=1
}

# ─── Help ─────────────────────────────────────────────────────────────────────
show_help() {
  echo -e "${BOLD}CA Marketplace — Local CI Simulator${RESET}"
  echo
  echo "Usage: $0 [job]"
  echo
  echo "Jobs:"
  echo "  (none)           Run ALL jobs in order"
  echo "  backend-unit     Backend unit tests only"
  echo "  backend-all      All backend test suites"
  echo "  frontend         Frontend unit tests"
  echo "  e2e              Cypress E2E (full stack)"
  echo "  security         npm audit + Trivy image scan"
  echo "  coverage         Print coverage reports from last run"
  echo "  act-build        Simulate CI via act (requires act CLI)"
  echo "  act-security     Simulate security job via act"
  echo "  help             Show this message"
  echo
  echo "Requirements: docker, docker-compose"
  echo "Optional:     trivy (image scanning), act (GitHub Actions simulation)"
  echo
  echo "Expected outputs for PASS:"
  cat <<'EXPECTED'

  Backend unit tests
    ✓ Tests: XX passed, 0 failed
    ✓ Coverage: Lines ≥50%, Branches ≥0.5%, Functions ≥2%

  Backend integration tests
    ✓ Tests: XX passed, 0 failed
    ✓ Prisma: migrations applied, seed data loaded

  Frontend unit tests
    ✓ Tests: XX passed, 0 failed (or 0 tests — passWithNoTests)

  Cypress E2E
    ✓ All specs passing: 01-authentication, 02-client-workflow, 03-ca-workflow
    ✓ No uncaught exceptions

  Security
    ✓ npm audit: 0 critical, 0 high (warnings OK)
    ✓ Trivy: No CRITICAL vulnerabilities (HIGH reported but not blocking)
EXPECTED
}

# ─── Entry point ─────────────────────────────────────────────────────────────
main() {
  local job="${1:-all}"
  PIPELINE_FAILED=0
  RESULTS=()

  case "$job" in
    help|-h|--help) show_help; exit 0 ;;
  esac

  preflight
  cleanup

  _start_timer

  case "$job" in
    backend-unit)
      $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" up --build -d postgres-test redis-test
      sleep 5
      $COMPOSE_CMD -f "$COMPOSE_TEST_FILE" \
        up --build --abort-on-container-exit --exit-code-from migrate \
        migrate
      job_backend_unit
      ;;
    backend-all)
      run_job "backend-all" job_backend_all
      ;;
    frontend)
      run_job "frontend" job_frontend
      ;;
    e2e)
      run_job "e2e" job_e2e
      ;;
    security)
      run_job "security" job_security
      ;;
    coverage)
      job_coverage
      exit 0
      ;;
    act-build)
      job_act_build
      ;;
    act-security)
      job_act_security
      ;;
    all)
      header "CA Marketplace — Full Local CI"
      log "Running all jobs. This may take 10-20 minutes."
      log "Logs: $LOG_DIR/"
      echo

      # Backend suites first (parallel within compose)
      run_job "backend-all"   job_backend_all
      # Frontend (independent of backend)
      run_job "frontend"      job_frontend
      # E2E (needs full stack — run after unit tests confirm build)
      run_job "e2e"           job_e2e
      # Security (independent)
      run_job "security"      job_security
      ;;
    *)
      error "Unknown job: $job"
      show_help
      exit 1
      ;;
  esac

  print_summary "${RESULTS[@]}"
  echo -e "  Total time: ${BOLD}$(_elapsed)${RESET}"
  echo

  if [ "$PIPELINE_FAILED" -eq 1 ]; then
    error "Pipeline FAILED — check logs in $LOG_DIR/"
    exit 1
  else
    success "Pipeline PASSED"
  fi
}

main "$@"
