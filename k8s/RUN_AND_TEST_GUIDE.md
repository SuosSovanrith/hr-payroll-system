# Run and Test Guide: Kubernetes Final Project

From `minikube start` to the end of testing. Every step says **where** to do it, **what it is for**, and **what you should see**.

This guide uses the domain **`hrsystem.com`**. If your files still say `aupp.com`, replace it first.

## How to read this guide

| Label | Meaning |
|---|---|
| **[PowerShell]** | A normal PowerShell window, opened in the repo root folder |
| **[PowerShell - Admin]** | PowerShell opened with *Run as administrator* |
| **[Postman]** | The Postman collection from the midterm, with `baseUrl` = `http://hrsystem.com` |
| **[Browser]** | Chrome, Edge or Firefox |
| **Expected** | What a correct result looks like |

| Part | What it is |
|---|---|
| **A. Set up** | Start the cluster and deploy (do once) |
| **B. Prepare Postman** | Point Postman at the cluster (do once) |
| **C. Testing** | Verify each requirement, one test at a time |
| **D. Stop and clean up** | When you are finished |

You will use **four windows** at the same time:

| Window | Used for |
|---|---|
| PowerShell (normal) | `kubectl` and scripts |
| PowerShell (Administrator) | the hosts file, then `minikube tunnel`, which must stay open |
| Postman | API tests |
| Browser | the log viewer |

---

## 0. Before you start (checklist)

- [ ] Docker Desktop is running (whale icon is steady)
- [ ] You are on the `final-k8s` branch with the latest code (`git pull`)
- [ ] `k8s\02-secret.yaml` exists and contains no `REPLACE_ME` (see README, Step 2)
- [ ] The 9 images `suossovanrith/hr-*:v1` are on Docker Hub and set to **Public**
- [ ] The domain in the files is `hrsystem.com`
- [ ] The old Docker Compose stack is stopped (`docker compose down` in the repo root), because it uses port 80

> **Skip the seed job.** The shared MongoDB already has the demo accounts. Never use `-WithSeed`.

---

# PART A. SET UP

## A1. Start the cluster
**[PowerShell]** Starts a small one-node Kubernetes cluster inside Docker.
```powershell
minikube start --driver=docker --cpus=4 --memory=6144
```
**Expected:** after a minute or two, the last line says `Done! kubectl is now configured to use "minikube" cluster`.
If it fails with a memory error, use `--memory=4096` instead.

## A2. Enable the Ingress controller
**[PowerShell]** Adds the nginx program that handles the domain name and routes the paths.
```powershell
minikube addons enable ingress
```
**Expected:** a line saying the `ingress` addon is enabled.

## A3. Wait until the Ingress controller is running
**[PowerShell]** The controller must be ready before you deploy the Ingress.
```powershell
kubectl get pods -n ingress-nginx
```
**Expected:** a pod named `ingress-nginx-controller-...` with `READY 1/1` and `STATUS Running`. Two other pods with `Completed` are normal. If it says `ContainerCreating`, wait 30 seconds and run the command again.

## A4. Check the Secret file is ready
**[PowerShell]** Makes sure you will not deploy with placeholder passwords.
```powershell
Test-Path k8s\02-secret.yaml
```
**Expected:** `True`.

```powershell
Select-String -Path k8s\02-secret.yaml -Pattern "REPLACE_ME"
```
**Expected:** **no output**. If any line is printed, open the file and fill in the value.

## A5. Allow the scripts to run (only if needed)
**[PowerShell]** Windows can block `.ps1` scripts. This allows them for **this window only**.
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
**Expected:** no output (answer `Y` if it asks).

## A6. Deploy everything
**[PowerShell]** Applies all the YAML files in the right order and waits until the pods are ready (2 to 5 minutes the first time, because the images are downloaded).
```powershell
.\k8s\scripts\deploy.ps1
```
**Expected:**
- lines like `namespace/hr-system created`, `deployment.apps/... created`, `ingress.networking.k8s.io/hr-ingress created`
- ten lines `deployment "..." successfully rolled out`
- at the end, a table of pods, services, the Ingress and the volume

If it stops with an error, read the message: it names the file that failed.

## A7. Check all pods are running
**[PowerShell]**
```powershell
kubectl get pods -n hr-system
```
**Expected:** 11 pods, all `Running`.

| Pod | READY |
|---|---|
| `api-gateway-...` (2 pods) | `2/2` (the app plus the log-tail container) |
| every other pod | `1/1` |

If a pod shows `ImagePullBackOff` or `CrashLoopBackOff`, see the README troubleshooting table.

## A8. Check the log volume exists
**[PowerShell]**
```powershell
kubectl get pvc -n hr-system
```
**Expected:** one line `hr-logs` with `STATUS Bound`.

## A9. Make the domain name work
**[PowerShell - Admin]** Tells Windows that `hrsystem.com` means your own computer.
```powershell
.\k8s\scripts\hosts-setup.ps1
```
**Expected:** `Added: 127.0.0.1 hrsystem.com` (or `Already present`).

**[PowerShell - Admin]** Check it.
```powershell
ping hrsystem.com
```
**Expected:** `Reply from 127.0.0.1`.

## A10. Open the tunnel (keep this window open)
**[PowerShell - Admin]** Forwards your computer's port 80 into the cluster. **Leave this window open for the whole demo and all the tests.** If you close it, the domain stops working.
```powershell
minikube tunnel
```
**Expected:** it prints that the tunnel started for the Ingress and then stays running without returning to a prompt.

## A11. First smoke test
**[Postman]** or **[Browser]** `GET http://hrsystem.com/health`

**Expected:** status `200` and
```json
{ "status": "ok", "service": "api-gateway", "instanceId": "api-gateway-xxxxxxxxxx-xxxxx" }
```
If this works, the cluster, the Ingress, the domain and the gateway all work. If it fails, check A10 (tunnel open?) and A9 (`ping` answers?).

---

# PART B. PREPARE POSTMAN

## B1. Point Postman at the cluster
**[Postman]** Open the collection, go to **Variables**, and set:

| Variable | Value |
|---|---|
| `baseUrl` | `http://hrsystem.com` |

Click **Save**. There is no port number, because the Ingress listens on port 80.

## B2. Log in as each role
**[Postman]** Run the three login requests from the collection (admin, HR, employee). They store the tokens in `adminToken`, `hrToken` and `employeeToken`.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@company.com` | `Admin@123` |
| HR Manager | `hr@company.com` | `Hr@12345` |
| Employee | `employee@company.com` | `Emp@12345` |

**Expected:** status `200` for each, with a `token` in the response. These accounts already exist in the shared database.

> Tokens expire after 1 hour. If you start getting `401 TOKEN_EXPIRED`, log in again.

---

# PART C. TESTING

Each test shows which requirement it proves. Take a screenshot of the **Expected** result.

> **Before testing:** the database still holds your midterm data. For "create" tests use **new values** (a new email, a different payslip month, new leave dates), or you will get `409 Conflict` instead of success.

## C1. Fanout DNS: one domain, different paths, different services
*Proves: requirement 5.*

**1. [Postman]** `GET http://hrsystem.com/health` goes to the **gateway**.
**Expected:** `200`, `service: api-gateway`.

**2. [Postman]** `GET http://hrsystem.com/api/lb-info` also goes to the **gateway**.
**Expected:** `200`, with `servedBy`, `hits` and `total`.

**3. [Browser]** Open `http://hrsystem.com/logs/`. This path goes to a **different Service** (the log viewer).
**Expected:** a plain page titled `Index of /logs/` listing `.log` files. If the list is empty, make some Postman calls first (see C3) and refresh.

**4. [PowerShell]** Shows the routing rules Kubernetes is using.
```powershell
kubectl describe ingress hr-ingress -n hr-system
```
**Expected:** `Host hrsystem.com` with `/api`, `/health` pointing to `api-gateway:3000` and `/logs` pointing to `log-viewer:80`.

## C2. Everything goes through the gateway
*Proves: requirement 3.*

**1. [PowerShell]** None of the services has an outside address.
```powershell
kubectl get svc -n hr-system
```
**Expected:** every service has `TYPE ClusterIP` and `EXTERNAL-IP <none>`.

**2. [Postman]** Call a protected API with **no token** (remove the Authorization header): `GET {{baseUrl}}/api/employees`
**Expected:** `401`, `"code": "NO_TOKEN"`. The gateway is checking the JWT.

**3. [Postman]** Try an internal route: `GET {{baseUrl}}/internal/employees/1` (with the admin token)
**Expected:** `404 NOT_FOUND`. Internal routes are not exposed.

**4. [PowerShell]** Try to call a microservice **directly**, from inside the cluster, bypassing the gateway.
```powershell
kubectl run curl-test -n hr-system --rm -it --restart=Never --image=curlimages/curl -- curl -s http://employee-service:3003/api/employees
```
**Expected:** a JSON error containing `"code":"GATEWAY_ONLY"`, then `pod "curl-test" deleted`. The service refuses a call that did not come through the gateway.

## C3. Application test (all APIs through the domain)
*Proves: the application works on Kubernetes; networking and database connectivity (requirements 3 and 4).*

**[Postman]** Run the collection folders in this order, using the right role's token. Use new values where noted.

| Folder | What to expect |
|---|---|
| Gateway / Auth | login `200`; wrong password `401`; register `201`; same email again `409`; admin creates staff `201`; HR lists users `200`; admin changes role `200` |
| Employee | HR creates profile `201`; HR lists `200`; employee sees own profile `200`; employee views another's profile `403`; update `200`; admin terminates `200` |
| Attendance | clock in `201`; clock in again `409`; clock out `200`; clock out again `409`; records and summary `200`; HR correction `200` |
| Leave | request `201`; overlapping dates `409`; list `200`; invalid status filter `400`; review `200`; cancel pending `200` |
| Performance | create `201`; list `200`; own reviews `200`; update `200` |
| Payroll | set salary `200`; generate payslip `201`; same month again `409`; list and detail `200` |
| Audit | failures `200`; successes `200`; invalid outcome `400`; one entry `200` |

**Also run the security checks**

| Test | Expected |
|---|---|
| No token | `401 NO_TOKEN` |
| Garbage or edited token | `401 INVALID_TOKEN` |
| Employee token on an HR API | `403` |
| HR token on an Admin API | `403` |
| Unknown route, e.g. `GET {{baseUrl}}/api/nothing` | `404` |

> These calls also create the log lines you will look at in C5.

## C4. Load balancing
*Proves: networking and load balancing across multiple pods.*

**1. [PowerShell]** See the two gateway pods and their names.
```powershell
kubectl get pods -n hr-system -l app=api-gateway -o wide
```
**Expected:** two pods named `api-gateway-<hash>-<id>`, both `Running`.

**2. [Postman]** Send `GET {{baseUrl}}/api/lb-info` **6 to 10 times** in a row.
**Expected:** each response looks like
```json
{ "servedBy": "api-gateway-6c7d9b8f5-abcde", "hits": { "api-gateway-6c7d9b8f5-abcde": 3 }, "total": 3, "storage": "in-memory (this pod only)" }
```
The `servedBy` value switches between the **two pod names** you saw in step 1. Each pod counts only its own requests (the counter is per pod; there is no Redis). The **Headers** tab also shows `X-Served-By` with the pod name.

**3. [PowerShell]** The same test as a single screenshot.
```powershell
.\k8s\scripts\test-lb.ps1 -Count 10
```
**Expected:** 10 lines, each showing a `servedBy` pod name, with both pod names appearing.

## C5. Shared volume
*Proves: requirement 6 (a volume shared by multiple pods and containers).*

Run C3 first so the log files contain lines.

**1. [PowerShell]** Look at the volume from inside the **employee** pod.
```powershell
kubectl exec -n hr-system deploy/employee-service -- ls -l /var/log/hr
```
**Expected:** a list of `.log` files named `<service>-<pod name>.log`, including files written by **other services** (`api-gateway-...`, `login-service-...`, and so on). One pod can see everyone's logs because they share one volume.

**2. [PowerShell]** Read another service's file from a **different** pod (the payroll pod reads the employee log).
```powershell
kubectl exec -n hr-system deploy/payroll-service -- sh -c 'tail -n 3 /var/log/hr/employee-service-*.log'
```
**Expected:** the last 3 request lines of the employee service, such as `GET /api/employees 200 ...`.

**3. [PowerShell]** Get the name of one gateway pod.
```powershell
$gw = kubectl get pods -n hr-system -l app=api-gateway -o jsonpath="{.items[0].metadata.name}"
$gw
```
**Expected:** a pod name like `api-gateway-6c7d9b8f5-abcde`.

**4. [PowerShell]** Read the same log through the **second container** in that pod (the sidecar).
```powershell
kubectl logs -n hr-system $gw -c log-tail --tail=5
```
**Expected:** the last 5 lines of the gateway's log. A second container in the same pod is reading the shared volume.

**5. [Browser]** Open `http://hrsystem.com/logs/`, refresh, and click a file.
**Expected:** a list of all the log files, and the file opens as plain text.

**6. [PowerShell]** Prove the data survives a pod being deleted. First delete the employee pod:
```powershell
kubectl delete pod -n hr-system -l app=employee-service
```
**Expected:** `pod "employee-service-..." deleted`.

**7. [PowerShell]** Wait about 20 seconds, then list the files again.
```powershell
kubectl exec -n hr-system deploy/payroll-service -- ls -l /var/log/hr
```
**Expected:** the **old** employee log file is still there, and a **new** file for the replacement pod appears next to it.

## C6. Self-healing
*Proves: Deployments keep pods running (requirement 1).*

**1. [PowerShell]** Watch the pods live. Leave this running.
```powershell
kubectl get pods -n hr-system -l app=api-gateway -w
```

**2. [PowerShell]** In a **second** normal PowerShell window, delete one gateway pod.
```powershell
$gw = kubectl get pods -n hr-system -l app=api-gateway -o jsonpath="{.items[0].metadata.name}"
kubectl delete pod -n hr-system $gw
```
**Expected (in the first window):** that pod goes `Terminating`, a new pod appears (`ContainerCreating`, then `Running`), and the count returns to 2. Press `Ctrl+C` to stop watching.

**3. [Postman]** While that happens, keep sending `GET {{baseUrl}}/api/lb-info`.
**Expected:** every request still returns `200`, because the second gateway pod keeps serving.

> Services with a single replica (for example employee) give a short `502 BAD_GATEWAY` for a few seconds when their pod is deleted, until the new pod is ready. That is expected.

## C7. Scaling (edit the YAML, then apply)
*Proves: Deployments and replicas, managed through YAML only.*

**1. [VS Code]** Open `k8s\10-api-gateway.yaml` and change `replicas: 2` to `replicas: 4`. Save.

**2. [PowerShell]** Apply the change.
```powershell
kubectl apply -f k8s\10-api-gateway.yaml
```
**Expected:** `deployment.apps/api-gateway configured`.

**3. [PowerShell]**
```powershell
kubectl get pods -n hr-system -l app=api-gateway
```
**Expected:** 4 gateway pods, all `Running` within about a minute.

**4. [Postman]** Send `GET {{baseUrl}}/api/lb-info` 10 times.
**Expected:** up to **four different** pod names in `servedBy`.

**5. [VS Code]** Change `replicas: 4` back to `2`, save, and run the apply command from step 2 again.
**Expected:** two pods go `Terminating` and 2 remain.

## C8. Rolling update with no downtime
*Proves: zero-downtime updates.*

**1. [VS Code]** In `k8s\10-api-gateway.yaml`, find the **first** `memory: 256Mi` (the gateway container's limit, not the sidecar's `32Mi`) and change it to `320Mi`. Save.

**2. [PowerShell]** Start a stream of requests in one window.
```powershell
.\k8s\scripts\test-lb.ps1 -Count 100
```

**3. [PowerShell]** Immediately, in a **second** window, apply the change.
```powershell
kubectl apply -f k8s\10-api-gateway.yaml
```

**4. [PowerShell]** Watch the update finish.
```powershell
kubectl rollout status deployment/api-gateway -n hr-system
```
**Expected:** `deployment "api-gateway" successfully rolled out`. In the first window, **all 100 requests succeed with no red errors**, and the pod names change as old pods are replaced one by one.

**5. [PowerShell]** See the revision history.
```powershell
kubectl rollout history deployment/api-gateway -n hr-system
```
**Expected:** at least two revisions.

## C9. ConfigMap, Secret and health probes
*Proves: configuration is separated from the images, and pods are health-checked.*

**1. [PowerShell]** Plain settings (service URLs).
```powershell
kubectl get configmap hr-config -n hr-system -o yaml
```
**Expected:** the service URLs (`http://employee-service:3003`, and so on) and `REDIS_DISABLED: "true"`.

**2. [PowerShell]** Sensitive values.
```powershell
kubectl describe secret hr-secrets -n hr-system
```
**Expected:** three keys (`MONGODB_URI`, `JWT_SECRET`, `INTERNAL_API_KEY`) shown **only with their size in bytes**, never the values.

**3. [PowerShell]** Probes, environment and volume mounts of one pod.
```powershell
kubectl describe pod -n hr-system -l app=login-service
```
**Expected:** scroll to find the `Liveness` and `Readiness` lines (both `http-get .../health`), the `Environment` section (values come from the ConfigMap and Secret), and `Mounts` showing `/var/log/hr`.

---

# PART D. STOP AND CLEAN UP

| Goal | Where | Command |
|---|---|---|
| Close the tunnel | **[PowerShell - Admin]** | press `Ctrl+C` in the tunnel window |
| Pause the cluster and keep everything (start again later with `minikube start`, then open the tunnel again) | **[PowerShell]** | `minikube stop` |
| Remove the project from the cluster, including the log volume | **[PowerShell]** | `.\k8s\scripts\destroy.ps1` |
| Delete the whole cluster | **[PowerShell]** | `minikube delete` |

MongoDB data is never affected by any of these.

---

# QUICK REFERENCE

## What to do before, during and after the demo

| When | What |
|---|---|
| **Before (never live)** | Part A completely, B1 and B2, a first round of C3 so the logs have content |
| **Live, quick** | `kubectl get pods -n hr-system` and `kubectl get svc -n hr-system`, a few Postman calls (login, one per role, a 401 and a 403), the browser at `/logs/`, `test-lb.ps1`, one `kubectl exec` listing, a pod delete (C6) |
| **Screenshots only (too slow live)** | C2 step 4, C7, C8, C9 |

## If something does not work

| Symptom | First thing to check |
|---|---|
| `hrsystem.com` does not open | Is the tunnel window still open (A10)? Does `ping hrsystem.com` answer `127.0.0.1` (A9)? |
| `502 BAD_GATEWAY` right after deploy | `kubectl get pods -n hr-system`: a pod is not `Running` yet. Wait, then retry |
| A pod is in `CrashLoopBackOff` | `kubectl logs <pod-name> -n hr-system --previous`. Usually a wrong `MONGODB_URI` |
| `ImagePullBackOff` | The image is not on Docker Hub or the repository is private |
| Everything returns `401` after login | Tokens expired, or the Secret changed. Log in again |
| `409` instead of success | Duplicate data from the midterm. Use new values |
| Anything else | `k8s\README.md`, section 7 (troubleshooting table) |
