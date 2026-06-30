#!/bin/bash
# ==============================================================================
# CloudMon TLS Certificate Generator (Development Only)
# ==============================================================================
# Generates a self-signed key and certificate for local Docker testing.
# Do NOT use these certificates in production!
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$SCRIPT_DIR/ssl"

mkdir -p "$SSL_DIR"

if [ -f "$SSL_DIR/nginx.key" ] && [ -f "$SSL_DIR/nginx.crt" ]; then
    echo "TLS certificates already exist in $SSL_DIR. Skipping generation."
    exit 0
fi

echo "Generating self-signed TLS certificates for development..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/nginx.key" \
  -out "$SSL_DIR/nginx.crt" \
  -subj "/C=US/ST=Dev/L=Local/O=CloudMon/OU=MVP/CN=localhost"

chmod 600 "$SSL_DIR/nginx.key"
chmod 644 "$SSL_DIR/nginx.crt"

echo "TLS certificates successfully generated at $SSL_DIR/"
