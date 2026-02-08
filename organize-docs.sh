#!/bin/bash

# Documentation Organization Script
# Organizes 190 markdown files into structured archive

# Removed 'set -e' to continue even if some files don't exist

echo "================================================"
echo "📚 CA Marketplace - Documentation Organization"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
archived=0
kept=0

# Create archive structure
echo -e "${BLUE}Creating archive directories...${NC}"
mkdir -p doc/archive/{fix-summaries,test-reports,phase-logs,status-updates,implementation-logs,duplicates,analytics,admin-logs,firm-logs,misc}

# Function to move file with logging
move_to_archive() {
    local file=$1
    local dest=$2

    if [ -f "$file" ]; then
        mv "$file" "doc/archive/$dest/"
        echo -e "${GREEN}✓${NC} Archived: $file → doc/archive/$dest/"
        ((archived++))
        return 0
    fi
    return 1
}

# Fix Summaries
echo ""
echo -e "${BLUE}Archiving fix summaries...${NC}"
move_to_archive "BLOCKER_FIXES.md" "fix-summaries"
move_to_archive "CRITICAL_BLOCKERS_FIXED.md" "fix-summaries"
move_to_archive "CRITICAL_GAPS_IMPLEMENTATION_SUMMARY.md" "fix-summaries"
move_to_archive "CLIENT_ISSUES_FIX_SUMMARY.md" "fix-summaries"
move_to_archive "FINAL_FIX_SUMMARY.md" "fix-summaries"
move_to_archive "FINAL_MVP_FIXES.md" "fix-summaries"
move_to_archive "FIXES_SUMMARY.md" "fix-summaries"
move_to_archive "FRONTEND_FIXES_SUMMARY.md" "fix-summaries"
move_to_archive "SCRIPTS_UPDATE_SUMMARY.md" "fix-summaries"
move_to_archive "SCRIPT_REVIEW_REPORT.md" "fix-summaries"
move_to_archive "CRITICAL_SECURITY_FIXES.md" "fix-summaries"
move_to_archive "CI_CD_FIXES.md" "fix-summaries"
move_to_archive "BUG_REPORT.md" "fix-summaries"

# Move FIXES directory
if [ -d "FIXES" ]; then
    mv FIXES/* doc/archive/fix-summaries/ 2>/dev/null || true
    rmdir FIXES 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Archived: FIXES/ directory"
    ((archived++))
fi

# Test Reports
echo ""
echo -e "${BLUE}Archiving test reports...${NC}"
move_to_archive "E2E_TEST_REPORT.md" "test-reports"
move_to_archive "E2E_TEST_RESULTS.md" "test-reports"
move_to_archive "COMPLETE_TEST_REPORT.md" "test-reports"
move_to_archive "ANALYTICS_TESTING.md" "test-reports"
move_to_archive "backend/BACKEND_TESTING_RESULTS.md" "test-reports"
move_to_archive "COMPREHENSIVE_TEST_PLAN.md" "test-reports"

# Phase Logs
echo ""
echo -e "${BLUE}Archiving phase logs...${NC}"
move_to_archive "docs/Phase-1-prompt-1.md" "phase-logs"
move_to_archive "docs/Phase-2_Step21-.md" "phase-logs"
move_to_archive "docs/Phase-2_Step22.md" "phase-logs"
move_to_archive "docs/Phase-3_Prompt_3.md" "phase-logs"
move_to_archive "docs/Phase-4_Prompt-4.md" "phase-logs"
move_to_archive "docs/Phase-5_Prompt-5.md" "phase-logs"
move_to_archive "docs/Phase-7_Prompt-7.md" "phase-logs"
move_to_archive "docs/PHASE1_EXECUTION_SUMMARY.md" "phase-logs"
move_to_archive "docs/PHASE1_FINAL_SUMMARY.md" "phase-logs"
move_to_archive "docs/PHASE1_FRONTEND_GAPS.md" "phase-logs"
move_to_archive "docs/PHASE1_IMPLEMENTATION_COMPLETE.md" "phase-logs"
move_to_archive "docs/PHASE1_IMPLEMENTATION_STATUS.md" "phase-logs"
move_to_archive "docs/PHASE1_PROGRESS_REPORT.md" "phase-logs"
move_to_archive "docs/PHASE2_EXECUTION_SUMMARY.md" "phase-logs"

# Status Updates
echo ""
echo -e "${BLUE}Archiving status updates...${NC}"
move_to_archive "MVP_NEXT_STEPS_STATUS.md" "status-updates"
move_to_archive "CONVERSATION_SUMMARY.md" "status-updates"
move_to_archive "IMPLEMENTATION_COMPLETE_SUMMARY.md" "status-updates"
move_to_archive "CA_WORKFLOW_ANALYSIS.md" "status-updates"
move_to_archive "FUNCTIONAL_REQUIREMENTS_VERIFICATION.md" "status-updates"

# Duplicates
echo ""
echo -e "${BLUE}Archiving duplicates...${NC}"
move_to_archive "EMAIL_SYSTEM_SUMMARY.md" "duplicates"
move_to_archive "EMAIL_INTEGRATION_COMPLETE.md" "duplicates"
move_to_archive "EMAIL_INTEGRATION_GUIDE.md" "duplicates"
move_to_archive "ESCROW_DEPLOYMENT_READY.md" "duplicates"
move_to_archive "ESCROW_QUICK_START.md" "duplicates"
move_to_archive "DASHBOARD_UPDATE_COMPLETE.md" "duplicates"
move_to_archive "PLATFORM_SETTINGS_DISPUTES_SUMMARY.md" "duplicates"

# Implementation Logs
echo ""
echo -e "${BLUE}Archiving implementation logs...${NC}"
move_to_archive "NOTIFICATION_SYSTEM_IMPLEMENTATION.md" "implementation-logs"
move_to_archive "ADVANCED_SEARCH_IMPLEMENTATION.md" "implementation-logs"
move_to_archive "DASHBOARD_METRICS_IMPLEMENTATION.md" "implementation-logs"
move_to_archive "COMPLETE_NOTIFICATION_SYSTEM.md" "implementation-logs"
move_to_archive "FILE_ATTACHMENT_IMPLEMENTATION.md" "implementation-logs"
move_to_archive "INTEGRATION_COMPLETE.md" "implementation-logs"
move_to_archive "backend/DATABASE_OPTIMIZATION.md" "implementation-logs"
move_to_archive "backend/API_OPTIMIZATION.md" "implementation-logs"

# CA Firms Docs
echo ""
echo -e "${BLUE}Archiving CA Firm implementation logs...${NC}"
move_to_archive "CA_FIRMS_IMPLEMENTATION_STATUS.md" "firm-logs"
move_to_archive "CA_FIRMS_SCHEMA_REVIEW.md" "firm-logs"
move_to_archive "CA_FIRMS_SCHEMA_SUMMARY.md" "firm-logs"
move_to_archive "CA_FIRMS_FEATURE_PLAN.md" "firm-logs"

# Analytics Docs
echo ""
echo -e "${BLUE}Archiving analytics docs...${NC}"
move_to_archive "ANALYTICS.md" "analytics"

# Demo Docs
echo ""
echo -e "${BLUE}Archiving demo docs...${NC}"
move_to_archive "DEMO_DATA_SUCCESS.md" "misc"
move_to_archive "DEMO_READY_SUMMARY.md" "misc"
move_to_archive "docs/DEMO_READINESS_CHECKLIST.md" "misc"

# Database Docs
echo ""
echo -e "${BLUE}Archiving obsolete database docs...${NC}"
move_to_archive "DATABASE_SETUP.md" "misc"

# Compliance & Audit
echo ""
echo -e "${BLUE}Archiving compliance docs...${NC}"
move_to_archive "COMPLIANCE.md" "misc"
move_to_archive "AUDIT_SYSTEM.md" "misc"

# Count remaining docs
echo ""
echo -e "${BLUE}Counting remaining documentation...${NC}"
remaining=$(find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/doc/archive/*" | wc -l)

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}Documentation Organization Complete${NC}"
echo "================================================"
echo ""
echo "Files Archived: $archived"
echo "Files Remaining: $remaining"
echo ""
echo "Archive Location: doc/archive/"
echo ""
echo "Next Steps:"
echo "1. Review doc/PROJECT_SUMMARY.md"
echo "2. Check doc/DOCUMENTATION_CATEGORIZATION.md"
echo "3. Verify archived files in doc/archive/"
echo ""
echo "================================================"
