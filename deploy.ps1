# ================= CONFIG =================
$APP = if ($env:DEPLOY_APP) { $env:DEPLOY_APP } else { "playnest-app" }
$SERVER = $env:DEPLOY_SERVER
$REMOTE_PATH = if ($env:DEPLOY_REMOTE_PATH) { $env:DEPLOY_REMOTE_PATH } else { "/srv" }
$PORT = if ($env:DEPLOY_PORT) { $env:DEPLOY_PORT } else { "3000" }

if ([string]::IsNullOrWhiteSpace($SERVER)) {
    throw "DEPLOY_SERVER environment variable is required (e.g. deploy@your-host.example)."
}

Write-Host "START DEPLOY"

# ================= BUILD =================
Write-Host "Building Docker image..."
docker build -t "${APP}:latest" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed"
    exit 1
}

# ================= SAVE =================
Write-Host "Saving image..."
docker save "${APP}:latest" -o "${APP}.tar"

# ================= UPLOAD =================
Write-Host "Uploading to server..."
scp "${APP}.tar" "${SERVER}:${REMOTE_PATH}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed"
    exit 1
}

# ================= REMOTE DEPLOY =================
Write-Host "Running remote deploy..."

ssh $SERVER @"
set -euo pipefail

echo 'Stop old container'
docker stop '$APP' 2>/dev/null || true

echo 'Remove old container'
docker rm '$APP' 2>/dev/null || true

echo 'Remove old image'
docker rmi '${APP}:latest' 2>/dev/null || true

echo 'Load new image'
docker load < '${REMOTE_PATH}/${APP}.tar'

echo 'Run new container (loopback-bound behind host reverse proxy)'
docker run -d \
  --restart always \
  --name '$APP' \
  --security-opt no-new-privileges:true \
  -p '127.0.0.1:${PORT}:${PORT}' \
  '${APP}:latest'

echo 'DEPLOY DONE'
"@

Remove-Item -Force -ErrorAction SilentlyContinue "${APP}.tar"
Write-Host "ALL DONE SUCCESSFULLY"
