# Piston Prebaked

[![Docker Publish](https://github.com/EXPKIKINT/piston-prebaked/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/EXPKIKINT/piston-prebaked/actions/workflows/docker-publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Piston API](https://img.shields.io/badge/Piston-v2-orange)](https://github.com/engineer-man/piston)

**Piston Prebaked** is a production-ready, batteries-included container image for the [Piston](https://github.com/engineer-man/piston) code execution engine with essential language runtimes and compilers pre-compiled directly into the container filesystem layer.

Designed for self-hosters, cloud platforms ([Coolify](https://coolify.io), Docker Compose, Kubernetes), and educational IDE platforms like **LaunchPD Classroom**.

---

## Why Piston Prebaked?

Standard Piston requires downloading and extracting language packages dynamically at runtime or mounting host volumes (`/piston/packages`). On low-spec VPS hosts (e.g., 1–2 GB RAM instances) or ephemeral containers, building compilers during deployment consumes 100% CPU, exhausts disk snapshots, and triggers `no space left on device` or kernel OOM errors.

**Piston Prebaked solves this:**
* **Zero Post-Deployment Setup**: Compilers are built off-host via GitHub Actions CI and baked directly into `/piston/packages`.
* **Instant Cold Starts**: Start the container and execute code immediately without manual `ppman install` commands.
* **No Host Volume Dependencies**: Completely self-contained container layer—ideal for multi-node deployments and stateless horizontal scaling.

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
  --name piston-prebaked \
  --privileged \
  -e PISTON_BIND_ADDRESS="0.0.0.0:2000" \
  -e PISTON_API_KEY="your-secret-api-key" \
  -e PISTON_DISABLE_NETWORKING="true" \
  ghcr.io/expkikint/piston-prebaked:latest
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
    image: ghcr.io/expkikint/piston-prebaked:latest
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
2. Set image to `ghcr.io/expkikint/piston-prebaked:latest`.
3. In **Environment Variables**, set:
   ```env
   PISTON_API_KEY=<your-secret-api-key>
   ```
4. Click **Deploy**.

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
Whenever changes are pushed to `main`, GitHub Actions automatically builds the Docker image and publishes it to GitHub Container Registry (`ghcr.io/<your-username>/piston-prebaked`).

To make the image publicly pullable without authentication:
1. Go to your GitHub profile -> **Packages** -> select `piston-prebaked`.
2. Click **Package settings** -> **Danger Zone** -> **Change package visibility** -> **Public**.

---

## License

This project is licensed under the [MIT License](LICENSE). Base Piston is licensed under MIT by Engineer Man.
