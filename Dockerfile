FROM ghcr.io/engineer-man/piston:latest

# Ensure piston packages root directory exists
RUN mkdir -p /piston/packages

# Copy installer script into API directory (where dependencies reside)
WORKDIR /piston_api
COPY install-runtimes.js ./

# Pre-install core runtime packages directly into container layer during build
RUN node install-runtimes.js && rm -f install-runtimes.js

# Expose standard Piston port 2000
EXPOSE 2000

ENV PORT="2000"
ENV PISTON_BIND_ADDRESS="0.0.0.0:2000"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:2000/', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

