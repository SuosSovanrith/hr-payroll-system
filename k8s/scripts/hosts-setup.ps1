<#
  Adds "127.0.0.1 aupp.com" to the Windows hosts file so the domain name resolves to your own machine
  (minikube tunnel forwards it into the cluster's Ingress).
  Run in a PowerShell opened AS ADMINISTRATOR:   .\k8s\scripts\hosts-setup.ps1
  Owner: Member 1
#>
$ErrorActionPreference = "Stop"
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$line = "127.0.0.1 aupp.com"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Open PowerShell as Administrator and run this script again." }
if (Select-String -Path $hosts -Pattern "^\s*127\.0\.0\.1\s+aupp\.com" -Quiet) {
  Write-Host "Already present: $line"
} else {
  Add-Content -Path $hosts -Value "`n$line"
  Write-Host "Added: $line" -ForegroundColor Green
}
ipconfig /flushdns | Out-Null
Write-Host "Now keep 'minikube tunnel' running (as Administrator) and open http://aupp.com/health"
