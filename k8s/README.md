# Final Project: HR & Payroll System on Kubernetes

The midterm microservices (same code, same APIs, same MongoDB Atlas database) now run on a **Kubernetes cluster (Minikube)**, described **only with YAML files**, with a domain name (`hrsystem.com`) using **fanout DNS**, and a **shared Kubernetes volume** for logs.

> Quick start for the impatient: [Step-by-step deployment](#4-step-by-step-deployment).

## Contents

1. [What changed from the midterm](#1-what-changed-from-the-midterm)
2. [Requirement coverage](#2-requirement-coverage)
3. [Architecture and files](#3-architecture-and-files)
4. [Step-by-step deployment](#4-step-by-step-deployment)
5. [Demos and verification](#5-demos-and-verification)
6. [Team checklist and screenshots](#6-team-checklist-and-screenshots)
7. [Troubleshooting](#7-troubleshooting)
8. [Cleanup](#8-cleanup)

---

## 1. What changed from the midterm

Only the **hosting layer** changed. The services, APIs, JWT/RBAC and the Atlas database are the same.

| Midterm (EC2 + Docker Compose) | Final (Kubernetes) |
|---|---|
| `docker-compose.yml` per EC2 instance | One **Deployment + Service** per microservice (YAML) |
| Nginx container as load balancer | **Ingress** (fanout DNS) + 2 gateway replicas behind a Service |
| `.env` files | **ConfigMap** (settings) + **Secret** (credentials) |
| 2 gateway containers `gw1`, `gw2` | Gateway Deployment with 2 replicas (pods named by Kubernetes) |
| Redis shared counter | Removed (no database container allowed): `/api/lb-info` uses an in-memory counter per pod |
| EC2 public IP | `http://hrsystem.com` (hosts file + `minikube tunnel`) |
| no shared storage | **PersistentVolumeClaim** `hr-logs` shared by all pods |

The only code change is in the gateway: `REDIS_DISABLED=true` switches `/api/lb-info` to the in-memory counter. Without that variable (Compose / EC2) it behaves exactly as before.

## 2. Requirement coverage

| Guideline | How it is met | Evidence |
|---|---|---|
| 1. Kubernetes deployment, YAML only | Every resource is a YAML file in `k8s/`, applied with `kubectl apply -f` | `k8s/*.yaml` |
| 2. Multiple Pods | 9 Deployments (gateway x2 replicas) + log-viewer = 11 pods, plus a 2-container gateway pod | `kubectl get pods -n hr-system` |
| 3. All requests through the API Gateway | Services are `ClusterIP` (no outside access); Ingress sends `/api` only to the gateway; services also reject calls without the internal key | Section 5.1 |
| 4. Cloud database, no database container | MongoDB Atlas; Redis removed | `01-configmap.yaml`, `02-secret` |
| 5. Fanout DNS with a domain | `hrsystem.com`: `/api` and `/health` to the gateway, `/logs` to the log viewer | `30-ingress.yaml`, Section 5.2 |
| 6. Kubernetes Volume shared by multiple containers | PVC `hr-logs` mounted by all service pods (write) and the log viewer (read-only); the gateway pod also has a second container reading it | Section 5.6 |
| 7. Local deployment with Minikube | Whole stack runs on Minikube | Section 4 |

## 3. Architecture and files

```
Postman / browser
      |  http://hrsystem.com   (hosts file -> 127.0.0.1, minikube tunnel)
      v
 Ingress (nginx controller)  --- fanout by path ---
      |  /api, /health                         |  /logs
      v                                        v
 Service api-gateway :3000                Service log-viewer :80 -> pod (nginx, read-only)
      |  load balanced across 2 pods
      v  (JWT check + RBAC)
 gateway pod 1 / gateway pod 2
      |  ClusterIP services only (no outside access)
      v
 registration :3001   login :3002   employee :3003   attendance :3004
 leave :3005   performance :3006   payroll :3007   audit :3008
      |
      +--> MongoDB Atlas (cloud database)

 Shared volume "hr-logs" (PVC): written by every service pod, read by the log-viewer
```

| File | What it creates | Owner |
|---|---|---|
| `00-namespace.yaml` | Namespace `hr-system` | Member 3 |
| `01-configmap.yaml` | `hr-config`: service URLs and settings | Member 3 |
| `templates/secret.example.yaml` | Template for `02-secret.yaml` (the real file is git-ignored) | Member 3 |
| `03-storage.yaml` | PVC `hr-logs` (1 Gi) | Member 2 |
| `10-api-gateway.yaml` | Gateway Deployment (2 replicas, + `log-tail` sidecar) and Service | Member 1 |
| `11-registration-service.yaml`, `12-login-service.yaml` | Registration and Login | Member 3 |
| `13-employee-service.yaml`, `14-attendance-service.yaml` | Employee and Attendance | Member 1 |
| `15-leave-service.yaml`, `16-performance-service.yaml` | Leave and Performance | Member 2 |
| `17-payroll-service.yaml`, `18-audit-service.yaml` | Payroll and Audit | Member 3 |
| `20-log-viewer.yaml` | nginx pod that serves the shared logs, + its ConfigMap and Service | Member 2 |
| `30-ingress.yaml` | Ingress with the `hrsystem.com` fanout | Member 1 |
| `optional/40-seed-job.yaml` | One-off Job that creates the demo accounts | Member 3 |
| `scripts/*.ps1` | Build/push images, deploy, hosts file, LB test, destroy | Member 1 / All |

Every YAML starts with a comment block (purpose, owner, apply/verify commands), so it can be read on its own.

Each service container:
- pulls its image from Docker Hub (`suossovanrith/hr-<service>:v1`),
- gets non-secret settings from the ConfigMap and only the secrets it needs from the Secret,
- runs as the non-root user,
- has readiness and liveness probes on `/health`, and CPU/memory requests and limits,
- writes its output to the console **and** to `/var/log/hr/<service>-<pod>.log` on the shared volume.

## 4. Step-by-step deployment

Commands are for **Windows PowerShell** (Docker Desktop with the WSL 2 backend).

### Step 0: Prerequisites (once)

```powershell
winget install Docker.DockerDesktop
winget install Kubernetes.minikube
winget install Kubernetes.kubectl
```
Start Docker Desktop, then check: `docker version`, `minikube version`, `kubectl version --client`.
You also need a Docker Hub login (`docker login`) with the **suossovanrith** account for pushing images (only the member who builds images needs it).

### Step 1: Get the files

```powershell
git checkout -b final-k8s
# the zip contents are already merged into the repo; check that k8s\ exists
dir k8s
```
Stop the old Compose stack if it is running (it uses port 80): `docker compose down`.

### Step 2: Create the Secret (never commit it)

```powershell
Copy-Item k8s\templates\secret.example.yaml k8s\02-secret.yaml
notepad k8s\02-secret.yaml      # replace every REPLACE_ME
```
- `MONGODB_URI`: the Atlas connection string (ask the project owner privately).
- `JWT_SECRET` and `INTERNAL_API_KEY`: any long random strings (hex characters are the safest). Each member's own Minikube can use its own values.
- Keep the double quotes. `k8s\.gitignore` already prevents `02-secret.yaml` from being committed.

### Step 3: Build and push the images (one member, once per code change)

```powershell
docker login
.\k8s\scripts\build-push-images.ps1            # builds and pushes 9 images, tag v1
```
Afterwards open https://hub.docker.com and make sure the 9 `hr-*` repositories are **Public** (Minikube pulls without a login).

Changed code later? Push a new tag (`-Tag v2`), replace `:v1` with `:v2` in the YAML files, and apply again.

### Step 4: Start Minikube and the Ingress controller

```powershell
minikube start --driver=docker --cpus=4 --memory=6144
minikube addons enable ingress
kubectl get pods -n ingress-nginx               # wait until the controller is Running
```
Low on RAM? Use `--memory=4096`.

### Step 5: Deploy everything

```powershell
.\k8s\scripts\deploy.ps1                        # add -WithSeed if the database is empty
```
The script checks the Secret, applies every file in order, waits for each Deployment, and prints `kubectl get all,ingress,pvc`. All pods should be `Running` and `1/1` (the gateway shows `2/2`, because it has two containers).

Manual equivalent: `kubectl apply -f k8s/00-namespace.yaml`, then 01, 02-secret, 03, 10 to 18, 20 and 30 in that order.

### Step 6: Make `hrsystem.com` work

In a PowerShell opened **as Administrator**:
```powershell
.\k8s\scripts\hosts-setup.ps1                   # adds: 127.0.0.1 hrsystem.com
minikube tunnel                                 # keep this window open during the demo
```
Test in a normal window:
```powershell
curl.exe http://hrsystem.com/health
```
It should return `{"status":"ok","service":"api-gateway",...}`.

### Step 7: Use the API

In Postman, set the collection variable `baseUrl` to `http://hrsystem.com` and run the existing collection (login first). Everything goes through `http://hrsystem.com/api/...`.

## 5. Demos and verification

All commands use `-n hr-system`.

### 5.1 Everything goes through the gateway

```powershell
kubectl get svc -n hr-system                     # all ClusterIP: no EXTERNAL-IP, no NodePort
curl.exe -i http://hrsystem.com/api/employees        # 401 NO_TOKEN: reaches the gateway, which demands a JWT
curl.exe -i http://hrsystem.com/internal/employees/1 # 404: internal routes are not exposed
# even from INSIDE the cluster, a service refuses a call that did not come through the gateway:
kubectl run curl-test -n hr-system --rm -it --restart=Never --image=curlimages/curl -- curl -s http://employee-service:3003/api/employees
# -> ... "code":"GATEWAY_ONLY"
```

### 5.2 Fanout DNS

```powershell
curl.exe -i http://hrsystem.com/health               # /health -> api-gateway
curl.exe -i http://hrsystem.com/api/lb-info          # /api    -> api-gateway
start http://hrsystem.com/logs/                      # /logs   -> log-viewer (a different Service and pod)
kubectl describe ingress hr-ingress -n hr-system # shows the host and the three path rules
```

### 5.3 Load balancing

```powershell
kubectl get pods -n hr-system -l app=api-gateway -o wide
.\k8s\scripts\test-lb.ps1 -Count 10              # servedBy alternates between the gateway pod names
```
The response header `X-Served-By` also shows the pod in Postman.

### 5.4 Scaling and rolling update (YAML only)

- **Scale:** in `k8s\10-api-gateway.yaml` change `replicas: 2` to `4`, run `kubectl apply -f k8s\10-api-gateway.yaml`, watch `kubectl get pods -n hr-system -w`, run `test-lb.ps1` (four different pod names), then set it back to 2.
- **Rolling update with zero downtime:** change the gateway memory limit `256Mi` to `320Mi`, apply, and run `test-lb.ps1 -Count 100` at the same time; the requests keep succeeding while pods are replaced one at a time. See `kubectl rollout status deployment/api-gateway -n hr-system` and `kubectl rollout history deployment/api-gateway -n hr-system`.

### 5.5 Self-healing

```powershell
kubectl delete pod -n hr-system -l app=employee-service
kubectl get pods -n hr-system -w                 # a new pod is created automatically
```
The API works again once the new pod is `Ready` (readiness probe).

### 5.6 Shared volume

```powershell
# 1. each service pod writes its own log file to the shared volume
kubectl exec -n hr-system deploy/employee-service -- ls -l /var/log/hr
# 2. a DIFFERENT pod reads a file written by another pod
kubectl exec -n hr-system deploy/payroll-service -- sh -c 'tail -n 3 /var/log/hr/employee-service-*.log'
# 3. a second CONTAINER in the same pod reads the gateway log
kubectl get pods -n hr-system -l app=api-gateway
kubectl logs -n hr-system <gateway-pod-name> -c log-tail --tail=5
# 4. the log viewer pod serves all the files in the browser
start http://hrsystem.com/logs/
# 5. the data outlives pods
kubectl delete pod -n hr-system -l app=employee-service
kubectl exec -n hr-system deploy/payroll-service -- ls -l /var/log/hr     # the old log file is still there
```
Make some API calls first (login, list employees) so the files contain lines.

### 5.7 ConfigMap, Secret and probes

```powershell
kubectl get configmap hr-config -n hr-system -o yaml      # plain settings
kubectl describe secret hr-secrets -n hr-system           # only sizes are shown, never the values
kubectl describe pod -n hr-system -l app=login-service    # Liveness / Readiness probes, env, mounts, events
```

## 6. Team checklist and screenshots

### Member 1: gateway, employee, attendance, Ingress, images

- [ ] Read and explain `10-api-gateway.yaml`, `13-employee-service.yaml`, `14-attendance-service.yaml`, `30-ingress.yaml`
- [ ] Screenshots: `kubectl describe ingress`, the `/health`, `/api` and `/logs/` fanout, the gateway-only tests (5.1), the load-balancing output (5.3) and `get pods -o wide`

### Member 2: leave, performance, shared volume, log viewer
- [ ] Read and explain `03-storage.yaml`, `15-leave-service.yaml`, `16-performance-service.yaml`, `20-log-viewer.yaml`
- [ ] Screenshots: `kubectl get pvc` (Bound), the volume demos (5.6): listing from two pods, the sidecar logs, the browser at `/logs/`, and the file surviving a pod deletion

### Member 3: registration, login, payroll, audit, ConfigMap, Secret
- [ ] Build and push the 9 images; the repositories are public
- [ ] Read and explain `11-registration-service.yaml`, `12-login-service.yaml`, `17-payroll-service.yaml`, `18-audit-service.yaml`, `00-namespace.yaml`, `01-configmap.yaml`, the Secret template
- [ ] Screenshots: `kubectl get all,ingress,pvc -n hr-system`, the ConfigMap and Secret descriptions (5.7), self-healing (5.5), scaling and rolling update (5.4), the seed job logs if used

### Everyone
- [ ] Postman through `http://hrsystem.com`: successful calls for every service, plus the 401 / 403 / 404 / 409 tests
- [ ] Screenshots of the YAML files for the report

## 7. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `ImagePullBackOff` / `ErrImagePull` | Image not pushed, repository private, or wrong tag. `kubectl describe pod <pod> -n hr-system` shows the image name |
| `CrashLoopBackOff` | `kubectl logs <pod> -n hr-system --previous`. Usually a wrong `MONGODB_URI`, Atlas Network Access not allowing your IP (`0.0.0.0/0`), or a missing Secret key |
| Pod `Pending` | Not enough memory or CPU: restart Minikube with more (`minikube stop`, `minikube start --memory=6144`), or `kubectl describe pod` for the reason |
| PVC stays `Pending` | `kubectl get storageclass` should show `standard`; if not: `minikube addons enable storage-provisioner` and `minikube addons enable default-storageclass`. A PVC binds when its first pod starts |
| `Permission denied` writing `/var/log/hr` | `minikube ssh -- sudo chmod -R 777 /tmp/hostpath-provisioner/hr-system/hr-logs`, then `kubectl rollout restart deployment -n hr-system` |
| `hrsystem.com` does not resolve | Hosts file entry missing (run `hosts-setup.ps1` as Administrator), then `ipconfig /flushdns`; `ping hrsystem.com` must answer from 127.0.0.1 |
| Connection refused / timeout on `hrsystem.com` | `minikube tunnel` is not running (needs an Administrator window), or the ingress controller is not ready: `kubectl get pods -n ingress-nginx`. Alternative: `kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 80:80` |
| Browser shows nginx `404 Not Found` | You used an IP or another host name; use `http://hrsystem.com/...`. Check `kubectl describe ingress hr-ingress -n hr-system` |
| `{"code":"BAD_GATEWAY"}` | The target service pod is not ready or its URL in `01-configmap.yaml` is wrong. `kubectl get pods -n hr-system`, then restart the gateway after changing the ConfigMap: `kubectl rollout restart deployment/api-gateway -n hr-system` |
| 401 on every call after login | `JWT_SECRET` differs between Login and the gateway (both read the same Secret). Re-apply the Secret and `kubectl rollout restart deployment -n hr-system` |
| ConfigMap or Secret change has no effect | Pods read them only at start: `kubectl rollout restart deployment -n hr-system` |
| Port 80 already in use | The old Docker Compose stack is still running: `docker compose down` in the repo root |
| `exec format error` | Images were built for a different CPU architecture: rebuild with the script (it forces `linux/amd64`) |
| Docker Hub pull rate limit | Wait a few minutes, or `docker login` inside Minikube: `minikube ssh` then `docker login` |
| `kubectl` talks to the wrong cluster | `kubectl config use-context minikube` |

Useful commands: `kubectl get pods -n hr-system -w` · `kubectl logs deploy/<name> -n hr-system` · `kubectl describe pod <pod> -n hr-system` · `kubectl exec -it deploy/<name> -n hr-system -- sh` · `kubectl get events -n hr-system --sort-by=.lastTimestamp`.

## 8. Cleanup

```powershell
.\k8s\scripts\destroy.ps1        # deletes the namespace: pods, services, ingress, ConfigMap, Secret and the log volume
minikube stop                    # or: minikube delete
```
MongoDB Atlas data is not affected.
