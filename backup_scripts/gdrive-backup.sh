#!/bin/bash
# =============================================================================
# Google Drive Backup Script for Libero
# =============================================================================
# This script syncs Docker volume backups to Google Drive using rclone.
#
# Usage: ./gdrive-backup.sh [sql|uploads|all]
#   sql     - Backup SQL database backups (recommended: every 26 minutes)
#   uploads - Backup photo uploads (recommended: every 6 hours)
#   all     - Backup both
#
# Prerequisites:
#   1. Install rclone: sudo apt install rclone OR curl https://rclone.org/install.sh | sudo bash
#   2. Configure rclone: rclone config (create a remote named "gdrive")
#   3. Create destination folders in Google Drive
# =============================================================================

set -e

# Configuration
RCLONE_REMOTE="gdrive"                                    # Your rclone remote name
GDRIVE_SQL_FOLDER="LiberoBackups/sql"                     # Google Drive folder for SQL backups
GDRIVE_UPLOADS_FOLDER="LiberoBackups/uploads"             # Google Drive folder for uploads
SQL_VOLUME_PATH="/var/lib/docker/volumes/libero-backups-data-prod/_data"
UPLOADS_VOLUME_PATH="/var/lib/docker/volumes/libero-uploads-data-prod/_data"
LOG_FILE="/var/log/libero-gdrive-backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Check if rclone is installed
check_rclone() {
    if ! command -v rclone &> /dev/null; then
        echo -e "${RED}Error: rclone is not installed.${NC}"
        echo "Install it with: sudo apt install rclone"
        echo "Or: curl https://rclone.org/install.sh | sudo bash"
        exit 1
    fi
}

# Check if rclone remote is configured
check_remote() {
    if ! rclone listremotes | grep -q "^${RCLONE_REMOTE}:$"; then
        echo -e "${RED}Error: rclone remote '${RCLONE_REMOTE}' is not configured.${NC}"
        echo "Run 'rclone config' to set up your Google Drive remote."
        exit 1
    fi
}

# Backup SQL files
backup_sql() {
    log "INFO" "Starting SQL backup sync..."
    
    if [ ! -d "$SQL_VOLUME_PATH" ]; then
        log "ERROR" "SQL volume path not found: $SQL_VOLUME_PATH"
        return 1
    fi
    
    rclone sync "$SQL_VOLUME_PATH" "${RCLONE_REMOTE}:${GDRIVE_SQL_FOLDER}" \
        --progress \
        --log-file="$LOG_FILE" \
        --log-level INFO \
        --transfers 4 \
        --checkers 8 \
        --contimeout 60s \
        --timeout 300s \
        --retries 3 \
        --low-level-retries 10
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "SQL backup completed successfully"
        echo -e "${GREEN}✓ SQL backup completed${NC}"
    else
        log "ERROR" "SQL backup failed"
        echo -e "${RED}✗ SQL backup failed${NC}"
        return 1
    fi
}

# Backup uploads (photos)
backup_uploads() {
    log "INFO" "Starting uploads backup sync..."
    
    if [ ! -d "$UPLOADS_VOLUME_PATH" ]; then
        log "ERROR" "Uploads volume path not found: $UPLOADS_VOLUME_PATH"
        return 1
    fi
    
    rclone sync "$UPLOADS_VOLUME_PATH" "${RCLONE_REMOTE}:${GDRIVE_UPLOADS_FOLDER}" \
        --progress \
        --log-file="$LOG_FILE" \
        --log-level INFO \
        --transfers 4 \
        --checkers 8 \
        --contimeout 60s \
        --timeout 300s \
        --retries 3 \
        --low-level-retries 10
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "Uploads backup completed successfully"
        echo -e "${GREEN}✓ Uploads backup completed${NC}"
    else
        log "ERROR" "Uploads backup failed"
        echo -e "${RED}✗ Uploads backup failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    local backup_type="${1:-all}"
    
    echo "========================================="
    echo "  Libero Google Drive Backup"
    echo "  $(date)"
    echo "========================================="
    
    check_rclone
    check_remote
    
    case "$backup_type" in
        sql)
            backup_sql
            ;;
        uploads)
            backup_uploads
            ;;
        all)
            backup_sql
            backup_uploads
            ;;
        *)
            echo "Usage: $0 [sql|uploads|all]"
            exit 1
            ;;
    esac
    
    log "INFO" "Backup process finished"
}

# Run main with arguments
main "$@"
