FROM ghcr.io/engineer-man/piston:latest

# Pre-install core runtime packages so they persist on ephemeral container hosts (e.g. SnapDeploy, Coolify)
RUN node /piston/cli/index.js ppman install python && \
    node /piston/cli/index.js ppman install nodejs && \
    node /piston/cli/index.js ppman install gcc && \
    node /piston/cli/index.js ppman install java && \
    node /piston/cli/index.js ppman install go && \
    node /piston/cli/index.js ppman install rust

EXPOSE 2000

ENV PISTON_BIND_ADDRESS="0.0.0.0:2000"
