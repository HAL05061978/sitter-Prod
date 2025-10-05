#!/bin/bash
# Enhanced Production Deployment Script for Git Bash
# This script provides a comprehensive production deployment process

echo ""
echo "========================================"
echo "🚀 CARE-N-CARE PRODUCTION DEPLOYMENT"
echo "========================================"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo ""
    echo "📝 Please create .env.production with your production values:"
    echo "   - Copy from env.production.example"
    echo "   - Update with your actual Supabase production credentials"
    echo "   - Set your production domain URL"
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi

echo "✅ Environment file found"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found!"
    echo ""
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Vercel CLI"
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

echo "✅ Vercel CLI ready"

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel..."
    vercel login
    if [ $? -ne 0 ]; then
        echo "❌ Vercel login failed"
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

echo "✅ Vercel authentication ready"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf .next
rm -rf node_modules/.cache

echo "✅ Cleanup complete"

# Build the application for production
echo "📦 Building application for production..."
npm run build:prod

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors and try again."
    echo ""
    echo "💡 Common fixes:"
    echo "   - Check your .env.production file"
    echo "   - Ensure all dependencies are installed"
    echo "   - Run 'npm run type-check' to check for TypeScript errors"
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi

echo "✅ Build successful"

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod --yes

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   - Check your Vercel project settings"
    echo "   - Verify environment variables in Vercel dashboard"
    echo "   - Ensure your domain is properly configured"
    echo ""
    read -p "Press Enter to continue..."
    exit 1
fi

echo ""
echo "========================================"
echo "✅ PRODUCTION DEPLOYMENT SUCCESSFUL!"
echo "========================================"
echo ""
echo "🌐 Your app is now live!"
echo "📧 Don't forget to:"
echo "   - Configure SMTP settings in Supabase dashboard"
echo "   - Test all functionality with real users"
echo "   - Monitor your app's performance"
echo "   - Set up error tracking and analytics"
echo ""
echo "🔗 Check your Vercel dashboard for the live URL"
echo ""
read -p "Press Enter to continue..."
