# ================= CONFIG =================
$APP = "my-app"
$SERVER = "root@87.248.152.195"
$REMOTE_PATH = "/srv"
$PORT = 3000

Write-Host "🚀 START DEPLOY"

# ================= BUILD =================
Write-Host "📦 Building Docker image..."
docker build -t $APP:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed"
    exit 1
}

# ================= SAVE =================
Write-Host "💾 Saving image..."
docker save $APP:latest -o "$APP.tar"

# ================= UPLOAD =================
Write-Host "📤 Uploading to server..."
scp "$APP.tar" "$SERVER:$REMOTE_PATH"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed"
    exit 1
}

# ================= REMOTE DEPLOY =================
Write-Host "🐧 Running remote deploy..."

ssh $SERVER "
set -e

echo '🧹 Stop old container'
docker stop $APP 2>/dev/null || true

echo '🧹 Remove old container'
docker rm $APP 2>/dev/null || true

echo '🧹 Remove old image'
docker rmi $APP:latest 2>/dev/null || true

echo '📦 Load new image'
docker load < $REMOTE_PATH/$APP.tar

echo '🚀 Run new container'
docker run -d \
  --restart always \
  --name $APP \
  -p $PORT:$PORT \
  $APP:latest

echo '✅ DEPLOY DONE'
"

Write-Host "🎉 ALL DONE SUCCESSFULLY"
