# Enhanced Production Deployment Script (PowerShell)
# This script provides a comprehensive production deployment process

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 CARE-N-CARE PRODUCTION DEPLOYMENT" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.production exists
if (-not (Test-Path ".env.production")) {
    Write-Host "❌ .env.production file not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Please create .env.production with your production values:" -ForegroundColor Yellow
    Write-Host "   - Copy from env.production.example" -ForegroundColor Yellow
    Write-Host "   - Update with your actual Supabase production credentials" -ForegroundColor Yellow
    Write-Host "   - Set your production domain URL" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Environment file found" -ForegroundColor Green

# Check if Vercel CLI is installed
$vercelVersion = vercel --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Vercel CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📦 Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Vercel CLI" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        exit 1
    }
    Write-Host "✅ Vercel CLI installed" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel CLI ready" -ForegroundColor Green
}

# Check if user is logged in to Vercel
$whoami = vercel whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔐 Please login to Vercel..." -ForegroundColor Yellow
    vercel login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Vercel login failed" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        exit 1
    }
    Write-Host "✅ Vercel authentication ready" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel authentication ready" -ForegroundColor Green
}

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }

Write-Host "✅ Cleanup complete" -ForegroundColor Green

# Build the application for production
Write-Host "📦 Building application for production..." -ForegroundColor Yellow
npm run build:prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please fix errors and try again." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Common fixes:" -ForegroundColor Yellow
    Write-Host "   - Check your .env.production file" -ForegroundColor Yellow
    Write-Host "   - Ensure all dependencies are installed" -ForegroundColor Yellow
    Write-Host "   - Run 'npm run type-check' to check for TypeScript errors" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green

# Deploy to Vercel
Write-Host "🌐 Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod --yes

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Check your Vercel project settings" -ForegroundColor Yellow
    Write-Host "   - Verify environment variables in Vercel dashboard" -ForegroundColor Yellow
    Write-Host "   - Ensure your domain is properly configured" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ PRODUCTION DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Your app is now live!" -ForegroundColor Green
Write-Host "📧 Don't forget to:" -ForegroundColor Yellow
Write-Host "   - Configure SMTP settings in Supabase dashboard" -ForegroundColor Yellow
Write-Host "   - Test all functionality with real users" -ForegroundColor Yellow
Write-Host "   - Monitor your app's performance" -ForegroundColor Yellow
Write-Host "   - Set up error tracking and analytics" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔗 Check your Vercel dashboard for the live URL" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"