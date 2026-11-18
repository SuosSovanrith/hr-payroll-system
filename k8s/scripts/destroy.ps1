<#
  Deletes EVERYTHING of the project from the cluster (pods, services, ingress, ConfigMap, Secret and the log volume).
  Run:  .\k8s\scripts\destroy.ps1
  The MongoDB Atlas data is NOT touched. Owner: All
#>
kubectl delete namespace hr-system --ignore-not-found
