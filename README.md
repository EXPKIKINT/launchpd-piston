# launchpd-piston

Production-ready, pre-baked [Piston](https://github.com/engineer-man/piston) code execution engine tailored for **LaunchPD Classroom IDE**.

This image builds on top of `ghcr.io/engineer-man/piston:latest` and pre-installs the most widely-used language runtimes during Docker build. This ensures all runtimes are baked directly into the container image layer, allowing instant execution without requiring persistent host volume mounts on ephemeral serverless platforms like **SnapDeploy** or self-hosted platforms like **Coolify**.

---

## Pre-baked Runtimes

| Language | Package | Aliases / Extensions |
| :--- | :--- | :--- |
| **Python** | `python` | `python3`, `py` |
| **JavaScript / TypeScript** | `nodejs` | `javascript`, `js`, `node` |
| **C / C++** | `gcc` | `c`, `cpp`, `c++` |
| **Java** | `java` | `java` |
| **Go** | `go` | `golang`, `go` |
| **Rust** | `rust` | `rs`, `rust` |

---

## Quick Start (Docker)

### Build the Image
```bash
docker build -t launchpd-piston .
```

### Run Locally or on VPS
```bash
docker run -d \
  -p 2000:2000 \
  --name launchpd-piston \
  --privileged \
  launchpd-piston
```

> **Note**: Piston uses Linux `isolate` sandboxing and requires `--privileged` (or `CAP_SYS_ADMIN`) permissions to create isolated user namespaces and cgroups.

---

## Deployment Guides

### Deploy on Coolify
1. In your Coolify dashboard, select **New Project** -> **From Git Repository**.
2. Connect `https://github.com/EXPKIKINT/launchpd-piston.git` (branch `main`).
3. Set **Build Pack** to **Dockerfile**.
4. Set **Port Exposes** to `2000`.
5. Under container settings / compose options, ensure privileged mode is enabled:
   ```yaml
   privileged: true
   ```
6. Deploy. Use the generated internal/external URL in your LaunchPD backend configuration:
   ```env
   PISTON_NODES=https://piston-node1.yourdomain.com/api/v2,https://piston-node2.yourdomain.com/api/v2
   ```

### Deploy on SnapDeploy
1. Connect this GitHub repository (`EXPKIKINT/launchpd-piston`) to SnapDeploy.
2. Select **Dockerfile** as the build configuration.
3. Configure the public or private service port as `2000`.
4. Deploy the service and link the resulting endpoint to LaunchPD backend.

---

## API Endpoints

### 1. Health & Installed Runtimes
```http
GET /api/v2/runtimes
```
Returns JSON list of all installed language runtimes and compilers.

### 2. Execute Code
```http
POST /api/v2/execute
Content-Type: application/json

{
  "language": "python",
  "version": "*",
  "files": [
    {
      "name": "main.py",
      "content": "print('Hello from LaunchPD Piston!')"
    }
  ],
  "stdin": "",
  "args": [],
  "run_timeout": 3000
}
```

---

## Configuration Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PISTON_BIND_ADDRESS` | `0.0.0.0:2000` | Network interface and port for the Piston HTTP API |
| `PISTON_DISABLE_NETWORKING` | `true` | Prevents sandboxed code from making external network calls |
| `PISTON_RUN_TIMEOUT` | `3000` | Max execution wall-time in milliseconds |
| `PISTON_OUTPUT_MAX_SIZE` | `1024` | Max stdout/stderr output size before truncation |

---

## License

MIT License. See [LICENSE](LICENSE) for details.
