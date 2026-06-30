#!/bin/bash
# ==============================================================================
# CLOUDMON AGENT INSTALLER (Idempotent bash script)
# ==============================================================================
# Setup steps:
# 1. Parse command line flags (--url, --token, --server-id, etc.)
# 2. Verify dependencies (python3, openssl, systemd)
# 3. Create low-privilege 'cloudmon-agent' user and 'cloudmon' group
# 4. Copy agent script to /usr/local/bin/cloudmon-agent.py
# 5. Write configuration to /etc/cloudmon-agent.conf (chmod 600)
# 6. Install and enable systemd service unit
# ==============================================================================

set -e

# Defaults
CHECK_INTERVAL=30
CA_BUNDLE=""
PROCESSES_LIST="[]"

# Helper to log messages
log() {
    echo -e "[\e[32mCloudMon-Setup\e[0m] $1"
}

log_err() {
    echo -e "[\e[31mCloudMon-Error\e[0m] $1" >&2
}

# Parse options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --url) API_URL="$2"; shift ;;
        --token) TOKEN="$2"; shift ;;
        --server-id) SERVER_ID="$2"; shift ;;
        --interval) CHECK_INTERVAL="$2"; shift ;;
        --ca-bundle) CA_BUNDLE="$2"; shift ;;
        --processes)
            # Convert comma-separated string to JSON array
            IFS=',' read -r -a array <<< "$2"
            PROCESSES_LIST=$(printf '%s\n' "${array[@]}" | jq -R . | jq -s -c .) || {
                # Fallback if jq is not installed
                PROCESSES_LIST="["
                first=true
                for p in "${array[@]}"; do
                    if [ "$first" = true ]; then
                        PROCESSES_LIST="$PROCESSES_LIST\"$p\""
                        first=false
                    else
                        PROCESSES_LIST="$PROCESSES_LIST,\"$p\""
                    fi
                done
                PROCESSES_LIST="$PROCESSES_LIST]"
            }
            shift ;;
        -h|--help)
            echo "Usage: $0 --url <API_URL> --token <TOKEN> --server-id <SERVER_ID> [options]"
            echo ""
            echo "Options:"
            echo "  --interval <seconds>  Metric report interval (default: 30)"
            echo "  --ca-bundle <path>    Local CA bundle file path to verify TLS (for self-signed certs)"
            echo "  --processes <p1,p2>   Comma-separated list of services to monitor uptime"
            exit 0
            ;;
        *) log_err "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Basic Validation
if [ -z "$API_URL" ] || [ -z "$TOKEN" ] || [ -z "$SERVER_ID" ]; then
    # If parameters not provided, try to read from existing config if available
    if [ -f "/etc/cloudmon-agent.conf" ]; then
        log "Configuration arguments omitted. Attempting to use existing configuration..."
    else
        log_err "Missing required parameters: --url, --token, and --server-id are mandatory."
        exit 1
    fi
fi

# Ensure python3 is installed
if ! command -v python3 &> /dev/null; then
    log_err "Python 3 is required but not found. Please install python3."
    exit 1
fi

# Ensure systemd is available
if ! command -v systemctl &> /dev/null; then
    log_err "systemd is required to install the agent service."
    exit 1
fi

# 1. Create system group 'cloudmon'
if ! getent group cloudmon > /dev/null; then
    log "Creating system group 'cloudmon'..."
    groupadd -r cloudmon
else
    log "System group 'cloudmon' already exists."
fi

# 2. Create system user 'cloudmon-agent' (low privilege, no shell)
if ! getent passwd cloudmon-agent > /dev/null; then
    log "Creating system user 'cloudmon-agent'..."
    useradd -r -s /bin/false -g cloudmon -c "CloudMon Agent User" cloudmon-agent
else
    log "System user 'cloudmon-agent' already exists."
fi

# 3. Copy/Deploy the Python Agent script to /usr/local/bin
log "Deploying agent script to /usr/local/bin/cloudmon-agent.py..."
# If running locally from git monorepo, copy the local file. Otherwise download.
SCRIPT_SOURCE="$(dirname "$0")/agent.py"
if [ -f "$SCRIPT_SOURCE" ]; then
    cp "$SCRIPT_SOURCE" /usr/local/bin/cloudmon-agent.py
else
    # In production, the portal will host the raw python agent file to curl down
    log_err "Local agent.py not found at $SCRIPT_SOURCE. Please ensure script runs inside the agent/ directory."
    exit 1
fi

chmod 750 /usr/local/bin/cloudmon-agent.py
chown cloudmon-agent:cloudmon /usr/local/bin/cloudmon-agent.py

# 4. Generate /etc/cloudmon-agent.conf securely
log "Writing configuration to /etc/cloudmon-agent.conf..."
# If parameters were not passed, we load existing values
if [ -n "$API_URL" ]; then
    # Generate JSON config
    cat <<EOF > /etc/cloudmon-agent.conf
{
  "api_url": "$API_URL",
  "token": "$TOKEN",
  "server_id": "$SERVER_ID",
  "check_interval": $CHECK_INTERVAL,
  "ca_bundle": "$CA_BUNDLE",
  "processes": $PROCESSES_LIST
}
EOF
fi

chmod 600 /etc/cloudmon-agent.conf
chown cloudmon-agent:cloudmon /etc/cloudmon-agent.conf

# 5. Create systemd service unit file
log "Creating systemd service file..."
cat <<EOF > /etc/systemd/system/cloudmon-agent.service
[Unit]
Description=CloudMon Client Monitoring Agent
After=network.target
Documentation=https://github.com/google/cloudmon

[Service]
Type=simple
User=cloudmon-agent
Group=cloudmon
ExecStart=/usr/bin/python3 /usr/local/bin/cloudmon-agent.py
Restart=on-failure
RestartSec=15s
# Minimal privilege environment overrides
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

# 6. Load, enable and start service unit
log "Activating systemd service..."
systemctl daemon-reload
systemctl enable cloudmon-agent.service
systemctl restart cloudmon-agent.service

log "\e[32mInstallation completed successfully!\e[0m"
log "The agent is running and will report metrics every ${CHECK_INTERVAL}s."
log "Status check: systemctl status cloudmon-agent"
