FROM alpine:3.18

# Use ArvanCloud mirror for Alpine packages
RUN sed -i 's|https\?://dl-cdn.alpinelinux.org|http://mirror.arvancloud.ir|g' /etc/apk/repositories

# Install dependencies
RUN apk add --no-cache \
    restic \
    postgresql-client \
    redis \
    bash \
    curl \
    rclone \
    ca-certificates \
    tzdata

# Create backup directory
RUN mkdir -p /backups /scripts /data /config /storage /redis_data /nginx_config /project_root

# Copy scripts
COPY scripts/backup/ /scripts/
COPY docker/backup/entrypoint.sh /entrypoint.sh
RUN chmod +x /scripts/*.sh /entrypoint.sh

# Default environment variables
ENV BACKUP_CRON="0 * * * *"
ENV RESTIC_REPOSITORY="/backups"
ENV POSTGRES_HOST="db"
ENV POSTGRES_PORT="5432"

ENTRYPOINT ["/entrypoint.sh"]
