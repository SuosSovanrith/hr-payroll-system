<#
  Builds the 9 service images and pushes them to Docker Hub (user suossovanrith).
  Run from anywhere:   .\k8s\scripts\build-push-images.ps1
  Options:             -Tag v1        image tag (must match the tag in the YAML files; default v1)
                       -NoPush        only build locally
                       -Only employee-service,payroll-service    build just some services
  Prerequisite:        docker login   (once, with the suossovanrith account)
  Owner:               Member 3
#>
param(
  [string]$Tag = "v1",
  [string]$User = "suossovanrith",
  [string[]]$Only = @(),
  [switch]$NoPush
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$services = "api-gateway","registration-service","login-service","employee-service","attendance-service",
            "leave-service","performance-service","payroll-service","audit-service"
if ($Only.Count -gt 0) { $services = $services | Where-Object { $Only -contains $_ } }

foreach ($s in $services) {
  $image = "$User/hr-${s}:${Tag}"
  Write-Host "`n=== Building $image ===" -ForegroundColor Cyan
  # linux/amd64 so the image also runs on EC2 and on Intel/AMD laptops, even if built on Apple silicon
  docker build --platform linux/amd64 -t $image "$root\services\$s"
  if ($LASTEXITCODE -ne 0) { throw "docker build failed for $s" }
  if (-not $NoPush) {
    docker push $image
    if ($LASTEXITCODE -ne 0) { throw "docker push failed for $s (did you run 'docker login'?)" }
  }
}
$built = foreach ($s in $services) { "$User/hr-${s}:${Tag}" }
Write-Host "`nDone. Images: $($built -join ', ')" -ForegroundColor Green
if (-not $NoPush) { Write-Host "Check that each repository is PUBLIC on https://hub.docker.com (Minikube pulls without a login)." }
