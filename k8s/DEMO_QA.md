# Demo Script and Q&A Cheat Sheet

Everyone must be able to explain every concept, not only their own files. Read this together once, then practice the demo with a different person presenting each part.

## 1. Demo script (about 8 minutes)

Preparation: Minikube running, everything deployed, `minikube tunnel` open in an Administrator window, Postman logged in as admin, one terminal in the repo root.

| Time | Presenter | What to show | What to say |
|---|---|---|---|
| 0:00 | Member 3 | `kubectl get all,ingress,pvc -n hr-system` | "11 pods run in the hr-system namespace. Each microservice is a Deployment with a Service. All YAML, no manual commands." |
| 1:00 | Member 3 | `kubectl get configmap`, `kubectl describe secret hr-secrets` | "Settings are in a ConfigMap, credentials in a Secret. The database is MongoDB Atlas in the cloud, so there is no database container." |
| 2:00 | Member 1 | `k8s\30-ingress.yaml`, then `http://aupp.com/health`, `/api/lb-info`, `/logs/` | "One domain, three paths, two backends: this is fanout DNS. `/api` and `/health` go to the gateway, `/logs` goes to the log viewer." |
| 3:00 | Member 1 | Postman: login, one call per role, a 401 and a 403 | "All client traffic goes through the gateway, which checks the JWT and the role." |
| 4:00 | Member 1 | `kubectl get svc`; the `curl-test` pod calling a service directly | "Services are ClusterIP, so nothing is exposed. Even inside the cluster a service rejects calls without the gateway's key." |
| 4:45 | Member 1 | `test-lb.ps1` | "Two gateway pods answer in turn. The pod name changes." |
| 5:30 | Member 2 | `kubectl exec ... ls /var/log/hr` from two pods, `kubectl logs -c log-tail`, browser `/logs/` | "One PersistentVolumeClaim is mounted by every pod. Different pods and different containers read the same files." |
| 6:30 | Member 2 | Delete a pod, list the files again | "The logs survive pod restarts because they live on the volume." |
| 7:00 | Member 3 | Edit `replicas`, apply, `get pods -w`; delete a pod | "Scaling is a YAML change. Kubernetes recreates deleted pods by itself (self-healing)." |

## 2. Likely questions and short answers

### Kubernetes basics
**What is a Pod?** The smallest unit Kubernetes runs: one or more containers that share network and volumes.

**Pod vs Deployment?** A Deployment describes the desired state (image, replicas, update strategy) and keeps that many pods running, replacing any that die. We never create bare pods.

**What is a Service, and why ClusterIP?** A Service gives a group of pods one stable internal name and IP (`employee-service:3003`) and balances traffic between them. ClusterIP is reachable only inside the cluster, which keeps our microservices private.

**What is a namespace?** A named area that groups all our resources (`hr-system`) and keeps them apart from other things in the cluster. Deleting it removes everything.

**Why YAML?** It is declarative: we describe what we want and `kubectl apply` makes the cluster match it. The files are versioned in Git and repeatable.

### Networking
**What does the Ingress do?** It is the front door: it receives HTTP requests from outside and routes them by host and path to Services. The Ingress controller (nginx) is the program that does the routing.

**What is fanout DNS in your project?** One domain name, `aupp.com`, with several paths pointing to different Services: `/api` and `/health` to the gateway, `/logs` to the log viewer. (Name-based virtual hosting would instead use different host names.)

**How does `aupp.com` reach Minikube?** The hosts file maps `aupp.com` to `127.0.0.1`; `minikube tunnel` forwards port 80 to the Ingress controller inside the cluster. In production a real DNS record would point to the cluster's address.

**How do you guarantee clients only use the gateway?** Three layers: only the gateway has a path in the Ingress; every other Service is ClusterIP; and each service rejects requests that do not carry the gateway's internal key (`GATEWAY_ONLY`).

**How do pods find each other?** Kubernetes DNS. Service names such as `payroll-service` resolve inside the namespace; the ConfigMap holds those URLs.

**How does load balancing work?** The gateway has two replicas. The Ingress controller spreads requests across the ready gateway pods in turn. `GET /api/lb-info` returns the pod name, and it changes between calls.

**Why did you remove Redis?** The final project forbids database containers. The load-balancing proof does not need shared state: the changing pod name is enough, so `lb-info` counts in memory per pod (`REDIS_DISABLED=true`).

### Configuration and security
**ConfigMap vs Secret?** A ConfigMap holds ordinary settings (service URLs). A Secret holds sensitive values (database URI, JWT secret, internal key). Both reach the container as environment variables.

**Are Secrets encrypted?** By default they are only base64-encoded, not encrypted, so we never commit the real file (`02-secret.yaml` is git-ignored) and each pod receives only the keys it needs.

**What other security measures did you use?** Containers run as a non-root user, JWT and role-based access control at the gateway, bcrypt-hashed passwords, ClusterIP-only services, and no database credentials in the images.

### Storage
**What is a volume, PV, PVC, StorageClass?** A PVC is a request for storage. The StorageClass (Minikube's default) automatically creates a PersistentVolume that satisfies it. Pods mount the PVC as a folder.

**How are the logs shared?** The `hr-logs` PVC is mounted at `/var/log/hr` in every service pod; each container's command copies its output into `<service>-<pod>.log` there. The log-viewer pod mounts the same volume read-only and serves the files.

**Why does ReadWriteOnce work with many pods?** It allows mounting by multiple pods on the same node. Minikube has one node. On a multi-node cluster we would need a ReadWriteMany storage type, or a central log system.

**What is the sidecar?** A second container in the gateway pod (`log-tail`) that reads the gateway's log file from the shared volume. It shows two containers in one pod sharing a volume.

**Why one file per pod?** To avoid several pods writing to the same file at once.

### Reliability
**Readiness vs liveness probe?** Readiness decides whether a pod receives traffic; liveness decides whether Kubernetes restarts the container. Both call `/health`.

**What happens when a pod dies?** The Deployment creates a replacement, and the Service stops sending traffic to the dead pod until the new one is ready.

**How do you scale?** Change `replicas` in the YAML and apply. Kubernetes starts or stops pods to match.

**What is a rolling update?** Pods are replaced gradually. With `maxUnavailable: 0` the gateway always keeps its pods serving while new ones start, so there is no downtime.

**Why resource requests and limits?** Requests let the scheduler place pods; limits stop one pod from using all of the machine's memory or CPU.

### Our project and process
**What changed from the midterm?** Only how it is hosted: Compose and EC2 became Deployments, Services, an Ingress, ConfigMap, Secret and a volume. The microservice code and database are the same.

**Why push images to Docker Hub?** The cluster pulls images from a registry; a public repository means Minikube needs no credentials.

**Why does the Deployment use a tag like `v1` instead of `latest`?** A fixed tag is reproducible: you always know which version is running, and changing the tag in YAML triggers a rolling update.

**How do you debug a failing pod?** `kubectl get pods`, `kubectl describe pod` (events), `kubectl logs --previous`, `kubectl exec` into the container.

**What would you improve next?** HTTPS on the Ingress, autoscaling (HPA), several replicas for every service, a central logging stack instead of a shared folder, external secret management, and a managed Kubernetes cluster.

## 3. Who explains what

| Topic | Primary | Be ready to answer |
|---|---|---|
| Ingress, fanout DNS, hosts file and tunnel, gateway-only, load balancing | Member 1 | Services, probes |
| Volumes, PVC, log viewer, sidecar, how logs are written | Member 2 | Ingress, Secrets |
| Namespace, ConfigMap, Secret, Deployments, scaling, rolling update, self-healing | Member 3 | Volumes, load balancing |
| Architecture, midterm vs final, Atlas, security (JWT/RBAC) | Everyone | |
