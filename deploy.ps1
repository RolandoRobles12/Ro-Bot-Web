# Deployment Script for Ro-Bot Slack Manager

Write-Host "🚀 Ro-Bot Deployment Script" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull latest changes
Write-Host "📥 Step 1: Pulling latest changes from GitHub..." -ForegroundColor Yellow
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to pull changes. Please check your connection." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Code updated successfully!" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy Firestore rules
Write-Host "🔐 Step 2: Deploying Firestore security rules..." -ForegroundColor Yellow
firebase deploy --only firestore:rules,firestore:indexes
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy Firestore rules. Check Firebase CLI setup." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Firestore rules deployed successfully!" -ForegroundColor Green
Write-Host ""

# Step 3: Build and deploy Functions
Write-Host "⚙️  Step 3: Building and deploying Cloud Functions..." -ForegroundColor Yellow
firebase deploy --only functions
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy Functions. Check the error above." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Cloud Functions deployed successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your dev server: npm run dev" -ForegroundColor White
Write-Host "  2. Refresh your browser (F5)" -ForegroundColor White
Write-Host "  3. Try creating a workspace and sending a test message" -ForegroundColor White
Write-Host ""
