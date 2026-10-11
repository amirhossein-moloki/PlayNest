#!/bin/bash
# sayra/scripts/prepare-deployment.sh

set -e

# Configuration
OUTPUT_FILE="playenest-deployment.tar"
IMAGES=("playenest-sayra:latest" "playenest-payload:latest" "playenest-nginx:latest" "playenest-backup:latest")

echo "🚀 Preparing deployment package..."

# 1. Build images
echo "📦 Building Docker images..."
docker compose build

# 2. Save images to tarball
echo "💾 Saving images to $OUTPUT_FILE..."
docker save -o "$OUTPUT_FILE" "${IMAGES[@]}"

echo "✅ Deployment package ready: $OUTPUT_FILE"
echo "👉 Transfer this file to your server and run: docker load -i $OUTPUT_FILE"
echo "👉 Then run: docker compose up -d"
