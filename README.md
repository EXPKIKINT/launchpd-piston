# Piston Swarm

[![Docker Publish](https://github.com/EXPKIKINT/piston-swarm/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/EXPKIKINT/piston-swarm/actions/workflows/docker-publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Piston API](https://img.shields.io/badge/Piston-v2-orange)](https://github.com/engineer-man/piston)

**Piston Swarm** is a production-ready, batteries-included container image for the [Piston](https://github.com/engineer-man/piston) code execution engine with essential language runtimes and compilers pre-compiled directly into the container filesystem layer.

Designed for self-hosters, cloud platforms ([Coolify](https://coolify.io), Docker Compose, Kubernetes), and educational IDE platforms like **LaunchPD Classroom**.

---

## Why Piston Swarm?

Standard Piston requires downloading and extracting language packages dynamically at runtime or mounting host volumes (`/piston/packages`). On low-spec VPS hosts (e.g., 1–2 GB RAM instances) or ephemeral containers, building compilers during deployment consumes 100% CPU, exhausts disk snapshots, and triggers `no space left on device` or kernel OOM errors.

**Piston Swarm solves this:**
* **Zero Post-Deployment Setup**: Compilers are built off-host via GitHub Actions CI and baked directly into `/piston/packages`.
* **Instant Cold Starts**: Start the container and execute code immediately without manual `ppman install` commands.
* **No Host Volume Dependencies**: Completely self-contained container layer—ideal for multi-node deployments, horizontal worker pools, and stateless execution fleets.

---

## Pre-installed Runtimes

| Language | Package Slug | Compiler / Runtime | Aliases & File Extensions |
| :--- | :--- | :--- | :--- |
| **Python** | `python` | Python 3 | `python3`, `py` |
| **JavaScript** | `node` | Node.js | `javascript`, `js`, `node` |
| **C / C++** | `gcc` | GCC / G++ | `c`, `cpp`, `c++` |
| **Java** | `java` | OpenJDK | `java` |
| **Go** | `go` | Go Compiler | `golang`, `go` |
| **Rust** | `rust` | Rustc / Cargo | `rs`, `rust` |

---

## Quick Start (Docker)

### 1. Run Pre-built Image from GHCR

```bash
docker run -d \
  -p 2000:2000 \
  --name piston-swarm \
  --privileged \
  -e PISTON_BIND_ADDRESS="0.0.0.0:2000" \
  -e PISTON_API_KEY="your-secret-api-key" \
  -e PISTON_DISABLE_NETWORKING="true" \
  ghcr.io/expkikint/piston-swarm:latest
```

> [!IMPORTANT]
> Piston uses Linux `isolate` sandboxing and requires `--privileged` (or `CAP_SYS_ADMIN`) permissions to create isolated user namespaces and cgroup limits.

### 2. Verify Container Health

```bash
# Check installed runtimes
curl -s http://localhost:2000/api/v2/runtimes | grep -o '"language":"[^"]*"'

# Test code execution
curl -X POST http://localhost:2000/api/v2/execute \
  -H "Content-Type: application/json" \
  -H "x-piston-api-key: your-secret-api-key" \
  -d '{
    "language": "python",
    "version": "*",
    "files": [{"content": "print(\"Piston is working!\")"}]
  }'
```

---

## Production Deployment (Docker Compose / Coolify)

### `docker-compose.yaml`

```yaml
version: '3.8'

services:
  piston:
    image: ghcr.io/expkikint/piston-swarm:latest
    container_name: piston_worker
    restart: always
    privileged: true
    ports:
      - "2000:2000"
    environment:
      - PISTON_BIND_ADDRESS=0.0.0.0:2000
      - PISTON_API_KEY=${PISTON_API_KEY:?PISTON_API_KEY required}
      - PISTON_DISABLE_NETWORKING=true
      - PISTON_OUTPUT_MAX_SIZE=65536
      - PISTON_MAX_PROCESS_COUNT=32
      - PISTON_MAX_OPEN_FILES=1024
      - PISTON_MAX_FILE_SIZE=5000000
      - PISTON_RUN_TIMEOUT=10000
      - PISTON_RUN_CPU_TIME=5000
      - PISTON_COMPILE_TIMEOUT=15000
      - PISTON_COMPILE_CPU_TIME=10000
      - PISTON_RUN_MEMORY_LIMIT=268435456
      - PISTON_COMPILE_MEMORY_LIMIT=536870912
      - PISTON_MAX_CONCURRENT_JOBS=16
    tmpfs:
      - /tmp:exec,size=256m
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:2000/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### Deploying on Coolify
1. In your Coolify dashboard, select **+ Add New Resource** -> **Docker Compose** (or **Docker Image**).
2. Set image to `ghcr.io/expkikint/piston-swarm:latest`.
3. In **Environment Variables**, set:
   ```env
   PISTON_API_KEY=<your-secret-api-key>
   ```
4. Click **Deploy**.

---

## Cloud Provider Deployment Guides

Deploying Piston on standalone cloud virtual machines (VMs) requires two essentials:
1. Running the container with **`--privileged`** (enables Piston's Linux `isolate` user namespaces and cgroup sandbox).
2. **Locking Port `2000`** in the cloud firewall strictly to your backend application's IP (`<BACKEND_SERVER_IP>/32`).

---

### 1. Amazon Web Services (AWS EC2)

#### Step 1: Security Group Configuration
1. Open **EC2 Console** -> **Security Groups** -> select or create your instance security group.
2. Under **Inbound rules**, add:
   * **SSH**: Port `22`, Source `My IP`.
   * **Piston API**: Type `Custom TCP`, Port `2000`, Source `<BACKEND_SERVER_IP>/32` (strictly your backend server).

#### Step 2: Provision & Launch Container
SSH into your EC2 instance (`ssh -i key.pem ubuntu@<EC2_PUBLIC_IP>`):

```bash
# 1. Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# 2. Run Piston Swarm Container
docker run -d \
  --name piston_worker \
  --restart always \
  --privileged \
  -p 2000:2000 \
  -e PISTON_BIND_ADDRESS="0.0.0.0:2000" \
  -e PISTON_API_KEY="your-secret-api-key" \
  -e PISTON_DISABLE_NETWORKING="true" \
  ghcr.io/expkikint/piston-swarm:latest
```

---

### 2. Oracle Cloud Infrastructure (OCI Compute)

Oracle Cloud provides generous Always Free compute (AMD `VM.Standard.E2.1.Micro` or Ampere `VM.Standard.A1.Flex`).

#### Step 1: VCN Ingress Rule (Cloud Firewall)
1. Go to **Networking** -> **Virtual Cloud Networks** -> select your VCN -> **Security Lists** -> click default Security List.
2. Click **Add Ingress Rules**:
   * **Source Type**: CIDR
   * **Source CIDR**: `<BACKEND_SERVER_IP>/32`
   * **IP Protocol**: TCP
   * **Destination Port Range**: `2000`
   * **Description**: `Piston API restricted strictly to backend`

#### Step 2: Host OS Firewall (`iptables` / `netfilter-persistent`)
> [!IMPORTANT]
> Oracle Cloud Ubuntu instances enforce internal `iptables` drop/reject rules by default. You must open Port 2000 in the host OS firewall:

```bash
# Allow Port 2000 from Backend IP in host iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 2000 -s <BACKEND_SERVER_IP> -j ACCEPT
sudo netfilter-persistent save
```

#### Step 3: Launch Container
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Run Piston Swarm
docker run -d \
  --name piston_worker \
  --restart always \
  --privileged \
  -p 2000:2000 \
  -e PISTON_BIND_ADDRESS="0.0.0.0:2000" \
  -e PISTON_API_KEY="your-secret-api-key" \
  -e PISTON_DISABLE_NETWORKING="true" \
  ghcr.io/expkikint/piston-swarm:latest
```

---

### 3. Google Cloud Platform (GCP Compute Engine)

#### Step 1: VPC Firewall Rule
Create a firewall rule restricting Port 2000 ingress strictly to your backend IP:

**Via `gcloud` CLI:**
```bash
gcloud compute firewall-rules create allow-piston-worker \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:2000 \
  --source-ranges="<BACKEND_SERVER_IP>/32" \
  --target-tags=piston-worker
```

**Or via Google Cloud Console:**
1. Navigate to **VPC network** -> **Firewall** -> **Create Firewall Rule**.
2. **Name**: `allow-piston-worker`.
3. **Targets**: Specified target tags (`piston-worker`).
4. **Source IPv4 ranges**: `<BACKEND_SERVER_IP>/32`.
5. **Protocols and ports**: Check **TCP** -> enter `2000`.

#### Step 2: Launch Compute Instance & Container
When launching the Compute Engine VM (e.g. `e2-micro` or `e2-medium` with Ubuntu 22.04 / 24.04 LTS):
1. In VM settings -> **Networking** -> add Network tag: `piston-worker`.
2. SSH into the VM:
```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Run Piston Swarm Container
docker run -d \
  --name piston_worker \
  --restart always \
  --privileged \
  -p 2000:2000 \
  -e PISTON_BIND_ADDRESS="0.0.0.0:2000" \
  -e PISTON_API_KEY="your-secret-api-key" \
  -e PISTON_DISABLE_NETWORKING="true" \
  ghcr.io/expkikint/piston-swarm:latest
```

---

## Security Best Practices

> [!CRITICAL]
> Piston executes arbitrary untrusted code. Never expose port 2000 directly to `0.0.0.0/0` on a public server.

1. **Firewall Restriction**: Whitelist incoming connections on port `2000` strictly to your application backend IP CIDR (`/32`):
   ```bash
   # Ubuntu UFW example:
   sudo ufw allow from <BACKEND_SERVER_IP> to any port 2000 proto tcp comment "Piston API"
   sudo ufw deny 2000/tcp comment "Block public access"
   ```
2. **API Key Authentication**: Always set `PISTON_API_KEY` to prevent unauthorized execution.
3. **Network Isolation**: Keep `PISTON_DISABLE_NETWORKING=true` to prevent sandboxed programs from making network requests or scanning your internal subnet.
4. **Kernel Cgroup Limits**: Restrict CPU and memory limits per process as configured in `docker-compose.yaml`.

---

## Building Locally / Customizing Runtimes

If you want to add or remove languages, edit `install-runtimes.js`:

```javascript
const RUNTIMES = [
    'python',
    'node',
    'gcc',
    'java',
    'go',
    'rust',
    // Add additional Piston package slugs:
    // 'csharp.net',
    // 'ruby',
    // 'php',
];
```

Build the custom Docker image:
```bash
docker build -t my-custom-piston:latest .
```

---

## Automated CI/CD (GitHub Actions)

This repository includes [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml).
Whenever changes are pushed to `main`, GitHub Actions automatically builds the Docker image and publishes it to GitHub Container Registry (`ghcr.io/<your-username>/piston-swarm`).

To make the image publicly pullable without authentication:
1. Go to your GitHub profile -> **Packages** -> select `piston-swarm`.
2. Click **Package settings** -> **Danger Zone** -> **Change package visibility** -> **Public**.

---

## License

This project is licensed under the [MIT License](LICENSE). Base Piston is licensed under MIT by Engineer Man.
