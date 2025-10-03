#!/bin/bash

# Production Deployment Script
# This script deploys the Care-N-Care app to production

set -e

echo "🚀 Starting production deployment..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "Please create .env.production from env.production.template and update with your production values."
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found!"
    echo "Please install it with: npm install -g vercel"
    exit 1
fi

echo "📦 Building application..."
npm run build:prod

echo "🗄️ Deploying database migrations..."
supabase db push --project-ref $SUPABASE_PROJECT_REF

echo "🔧 Deploying Edge Functions..."
supabase functions deploy send-group-invite --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy send-confirmation --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy send-welcome --project-ref $SUPABASE_PROJECT_REF

echo "🌐 Deploying to Vercel..."
vercel --prod

echo "✅ Production deployment complete!"
echo "🔗 Your app is now live at: https://care-n-care.com"
echo "📧 Make sure to configure your SMTP settings in Supabase dashboard"
echo "🔔 Test the notification system to ensure everything is working"