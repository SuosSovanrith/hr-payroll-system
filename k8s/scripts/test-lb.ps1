<#
.SYNOPSIS
    Demonstrates load balancing across API Gateway replicas.

.DESCRIPTION
    Sends multiple requests to the gateway and displays
    which Pod handled each request.

.PARAMETER Count
    Number of requests to send. Default: 10.

.PARAMETER BaseUrl
    Base URL of the HR system. Default: http://hrsystem.com.

.NOTES
    Owner: Member 1

.EXAMPLE
    .\k8s\scripts\test-lb.ps1

.EXAMPLE
    .\k8s\scripts\test-lb.ps1 -Count 20
#>

param(
    [int]$Count = 10,
    [string]$BaseUrl = "http://hrsystem.com"
)

# Validate the request count
if ($Count -lt 1) {
    throw "Count must be at least 1."
}

# Prepare the API endpoint
$endpoint = "$($BaseUrl.TrimEnd('/'))/api/lb-info"

Write-Host "Starting load-balancing test..."
Write-Host "Endpoint: $endpoint"
Write-Host "Requests: $Count"
Write-Host ""

# Send requests and display the responding Pod
for ($i = 1; $i -le $Count; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method Get

        Write-Host (
            "{0,2}  Served by: {1}  (Total: {2})" -f `
                $i,
                $response.data.servedBy,
                $response.data.total
        )
    }
    catch {
        Write-Host "Request $i failed: $($_.Exception.Message)" `
            -ForegroundColor Red

        throw
    }
}

Write-Host ""
Write-Host "Load-balancing test completed." -ForegroundColor Green
