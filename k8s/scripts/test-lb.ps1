<#
  Load-balancing demo: calls GET /api/lb-info many times and prints which gateway POD answered each request.
  Run:  .\k8s\scripts\test-lb.ps1            (default 10 calls)     .\k8s\scripts\test-lb.ps1 -Count 20
  The pod name should change between calls (round robin across the gateway replicas).
  Owner: Member 1
#>
param([int]$Count = 10, [string]$BaseUrl = "http://hrsystem.com")
for ($i = 1; $i -le $Count; $i++) {
  $r = Invoke-RestMethod "$BaseUrl/api/lb-info"
  "{0,2}  servedBy = {1}   (this pod has answered {2} request(s))" -f $i, $r.data.servedBy, $r.data.total
}
