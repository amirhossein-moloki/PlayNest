FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    bash \
    postgresql15-client \
    openssl \
    curl \
    aws-cli \
    tar \
    gzip \
    tzdata \
    redis

# Create directory structure
RUN mkdir -p /backups /scripts /restore /redis-data

WORKDIR /scripts

# Copy crontab
COPY crontab /etc/crontabs/root

# Create log file
RUN touch /var/log/cron.log

CMD ["crond", "-f", "-l", "2"]
