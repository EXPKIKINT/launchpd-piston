FROM ghcr.io/engineer-man/piston:latest

# Ensure piston packages root directory exists
RUN mkdir -p /piston/packages

# Provide native curl and wget shims for Coolify healthchecks (avoids EOL Debian Buster apt failures)
RUN printf '#!/usr/bin/env node\nconst http = require("http");\nconst https = require("https");\nconst urlStr = process.argv.find(a => a.startsWith("http://") || a.startsWith("https://")) || "http://127.0.0.1:2000/";\ntry {\n  const url = new URL(urlStr);\n  const client = url.protocol === "https:" ? https : http;\n  const req = client.get(url, (res) => {\n    process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1);\n  });\n  req.on("error", () => process.exit(1));\n  req.setTimeout(4000, () => { req.destroy(); process.exit(1); });\n} catch {\n  process.exit(1);\n}\n' > /usr/local/bin/curl && \
    chmod +x /usr/local/bin/curl && \
    ln -sf /usr/local/bin/curl /usr/local/bin/wget

# Copy installer script into API directory (where dependencies reside)
WORKDIR /piston_api
COPY install-runtimes.js ./

# Pre-install core runtime packages directly into container layer during build
RUN node install-runtimes.js && rm -f install-runtimes.js

# Copy patched compiler scripts (fixes multi-file C/C++ builds, header preservation, and Rust multi-file execution)
COPY packages/gcc/10.2.0/compile /piston/packages/gcc/10.2.0/compile
COPY packages/rust/1.68.2/compile /piston/packages/rust/1.68.2/compile
RUN chmod +x /piston/packages/gcc/10.2.0/compile /piston/packages/rust/1.68.2/compile

# Expose standard Piston port 2000
EXPOSE 2000

ENV PORT="2000"
ENV PISTON_BIND_ADDRESS="0.0.0.0:2000"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:2000/', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

