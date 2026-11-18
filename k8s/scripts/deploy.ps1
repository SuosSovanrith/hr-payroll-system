<#
  Applies every manifest in the right order, waits until the pods are ready, and prints the cluster state.
  Run from anywhere:   .\k8s\scripts\deploy.ps1
  Option:              -WithSeed     also run the optional job that creates the demo accounts
  Prerequisites:       minikube running + ingress addon enabled, k8s\02-secret.yaml filled in
  Owner:               All
#>
param([switch]$WithSeed)
$ErrorActionPreference = "Stop"
$k8s = (Resolve-Path "$PSScriptRoot\..").Path
$ns = "hr-system"

$secret = "$k8s\02-secret.yaml"
if (-not (Test-Path $secret)) {
  throw "Missing k8s\02-secret.yaml. Copy k8s\templates\secret.example.yaml to k8s\02-secret.yaml and fill in the values."
}
if (Select-String -Path $secret -Pattern "REPLACE_ME" -Quiet) {
  throw "k8s\02-secret.yaml still contains REPLACE_ME. Fill in the real values first."
}

$order = @("00-namespace.yaml","01-configmap.yaml","02-secret.yaml","03-storage.yaml",
           "10-api-gateway.yaml","11-registration-service.yaml","12-login-service.yaml",
           "13-employee-service.yaml","14-attendance-service.yaml","15-leave-service.yaml",
           "16-performance-service.yaml","17-payroll-service.yaml","18-audit-service.yaml",
           "20-log-viewer.yaml","30-ingress.yaml")
foreach ($f in $order) {
  Write-Host "kubectl apply -f $f" -ForegroundColor Cyan
  kubectl apply -f "$k8s\$f"
  if ($LASTEXITCODE -ne 0) { throw "apply failed for $f" }
}

if ($WithSeed) {
  kubectl delete job seed-demo-users -n $ns --ignore-not-found | Out-Null
  kubectl apply -f "$k8s\optional\40-seed-job.yaml"
}

Write-Host "`nWaiting for deployments..." -ForegroundColor Cyan
foreach ($d in "api-gateway","registration-service","login-service","employee-service","attendance-service",
               "leave-service","performance-service","payroll-service","audit-service","log-viewer") {
  kubectl rollout status deployment/$d -n $ns --timeout=180s
}
Write-Host ""
kubectl get all,ingress,pvc -n $ns
Write-Host "`nNext: add '127.0.0.1 aupp.com' to the hosts file (k8s\scripts\hosts-setup.ps1) and run 'minikube tunnel'." -ForegroundColor Green
