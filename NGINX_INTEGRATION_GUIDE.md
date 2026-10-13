# NGINX Integration Guide

This document describes the NGINX integration into the PlayNest Docker-based infrastructure.

## Architecture Overview

The integration introduces NGINX as a production-grade reverse proxy and load balancer in front of the Sayra reservation backend and Payload CMS backend.

### Network Flow Diagram

```mermaid
graph LR
    Client([Internet/Client]) -->|Port 80| NGINX[NGINX Reverse Proxy]

    subgraph "Docker Internal Network"
        NGINX -->|/api/v1, /api/reservations| Sayra[Sayra Express Backend]
        NGINX -->|/admin, /api/payload| Payload[Payload CMS Backend]
        Sayra -->|Port 5432| DB[(PostgreSQL Shared Server)]
        Payload -->|Port 5432| DB
        Sayra -->|Port 6379| Redis[(Redis)]
    end

    NGINX -.->|Direct Read| Media[(Storage / Media Volumes)]
```

## Routing & Services Overview

- `/api/v1/` & `/api/reservations/` → `sayra` backend service (`http://sayra:3000`).
- `/health`, `/api-docs`, `/swagger`, `/openapi.yaml`, `/openapi.json` → `sayra` health checks and Sayra Swagger UI.
- `/admin` → `payload` CMS admin panel (`http://payload:3000`).
- `/api/payload/` & `/api/graphql` → `payload` CMS API endpoints.
- `/payload-api-docs`, `/payload-openapi.yaml`, `/payload-openapi.json` → `payload` CMS Swagger UI and OpenAPI specifications.
- `/` → Gateway status placeholder.

## Configuration Files

- `docker/nginx/nginx.conf`: Global NGINX settings.
- `docker/nginx/conf.d/app.conf.template`: Application server blocks and routing templates.
- `docker/nginx/Dockerfile`: Custom NGINX image build instructions.
