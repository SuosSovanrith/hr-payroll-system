<#
.SYNOPSIS
    Adds the HR system domain to the Windows hosts file.

.DESCRIPTION
    Maps hrsystem.com to 127.0.0.1 so the domain can reach
    the Kubernetes Ingress through Minikube Tunnel.

.NOTES
    Owner: Member 1
    Run PowerShell as Administrator.

.EXAMPLE
    .\k8s\scripts\hosts-setup.ps1
#>

$ErrorActionPreference = "Stop"

# Configuration
$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsEntry = "127.0.0.1 hrsystem.com"

# Check administrator privileges
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($currentUser)
$isAdmin = $principal.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
    throw "Administrator privileges required. Reopen PowerShell as Administrator."
}

# Check whether the domain entry already exists
$entryExists = Select-String `
    -Path $hostsFile `
    -Pattern "^\s*127\.0\.0\.1\s+hrsystem\.com" `
    -Quiet

if ($entryExists) {
    Write-Host "Hosts entry already exists: $hostsEntry"
}
else {
    Add-Content -Path $hostsFile -Value "`n$hostsEntry"
    Write-Host "Hosts entry added: $hostsEntry" -ForegroundColor Green
}

# Refresh the Windows DNS cache
ipconfig /flushdns | Out-Null

Write-Host ""
Write-Host "Setup completed." -ForegroundColor Green
Write-Host "Keep Minikube Tunnel running as Administrator."
Write-Host "Test using: http://hrsystem.com/health"
