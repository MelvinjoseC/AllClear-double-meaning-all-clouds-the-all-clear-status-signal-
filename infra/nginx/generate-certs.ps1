# ==============================================================================
# CloudMon TLS Certificate Generator (PowerShell - Development Only)
# ==============================================================================

$sslDir = Join-Path $PSScriptRoot "ssl"
if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir | Out-Null
}

$keyPath = Join-Path $sslDir "nginx.key"
$certPath = Join-Path $sslDir "nginx.crt"

if ((Test-Path $keyPath) -and (Test-Path $certPath)) {
    Write-Host "TLS certificates already exist in $sslDir. Skipping generation." -ForegroundColor Green
    Exit
}

Write-Host "Generating self-signed TLS certificates for development..." -ForegroundColor Cyan

# Use openssl if available, otherwise fallback to New-SelfSignedCertificate
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
      -keyout $keyPath `
      -out $certPath `
      -subj "/C=US/ST=Dev/L=Local/O=CloudMon/OU=MVP/CN=localhost"
    Write-Host "Certificates generated successfully using OpenSSL." -ForegroundColor Green
} else {
    Write-Host "OpenSSL not found. Attempting to generate using New-SelfSignedCertificate..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -FriendlyName "CloudMon MVP Dev"
    
    # Export certificate (PEM)
    $certPem = "-----BEGIN CERTIFICATE-----`r`n" + [Convert]::ToBase64String($cert.RawData, "InsertLineBreaks") + "`r`n-----END CERTIFICATE-----"
    Set-Content -Path $certPath -Value $certPem -Encoding Ascii
    
    # Export private key (needs a password for export, then decrypt it or warn user)
    Write-Host "Note: If you run into issues, please install OpenSSL or Git Bash and run generate-certs.sh" -ForegroundColor Yellow
}
