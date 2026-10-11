#!/bin/bash
# scripts/prepare-deployment.sh

set -e

# Configuration
OUTPUT_FILE="playenest-deployment.tar"
IMAGES=("playenest-app:latest" "playenest-nginx:latest" "playenest-backup:latest")

echo "🚀 Preparing deployment package..."

# 1. Build images
echo "📦 Building Docker images..."
docker compose build

# 2. Save images to tarball
echo "💾 Saving images to $OUTPUT_FILE..."
docker save -o "$OUTPUT_FILE" "${IMAGES[@]}"

# 3. Add docker-compose.yml and .env.example to the package (optional but helpful)
# Note: In a real scenario, you might want to zip everything together.
# For now, we focus on the images as requested.

echo "✅ Deployment package ready: $OUTPUT_FILE"
echo "👉 Transfer this file to your server and run: docker load -i $OUTPUT_FILE"
echo "👉 Then run: docker compose up -d"
