#!/bin/bash

# =============================================
# DEPLOY PRODUCTION FIXES SCRIPT
# =============================================
# This script helps deploy the production database fixes

echo "🚀 Starting Production Database Fix Deployment..."

# Check if we're in the right directory
if [ ! -f "production_database_fix.sql" ]; then
    echo "❌ Error: production_database_fix.sql not found in current directory"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found production_database_fix.sql"

# Instructions for manual deployment
echo ""
echo "📋 MANUAL DEPLOYMENT INSTRUCTIONS:"
echo "=================================="
echo ""
echo "1. Go to your Supabase Dashboard:"
echo "   https://supabase.com/dashboard"
echo ""
echo "2. Select your production project"
echo ""
echo "3. Go to SQL Editor (left sidebar)"
echo ""
echo "4. Copy the contents of production_database_fix.sql"
echo ""
echo "5. Paste the SQL into the editor and click 'Run'"
echo ""
echo "6. Wait for all queries to complete successfully"
echo ""
echo "7. Verify the deployment by checking:"
echo "   - All tables exist"
echo "   - All functions are created"
echo "   - No errors in the execution log"
echo ""

# Check if we can detect the Supabase URL from environment
if [ -f ".env.production" ]; then
    echo "🔍 Found .env.production file"
    SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" .env.production | cut -d '=' -f2)
    if [ ! -z "$SUPABASE_URL" ]; then
        echo "📍 Supabase URL: $SUPABASE_URL"
        echo "   You can access your dashboard at: https://supabase.com/dashboard/project/$(echo $SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')"
    fi
else
    echo "⚠️  No .env.production file found"
    echo "   Make sure your environment variables are set in Vercel"
fi

echo ""
echo "🔧 ENVIRONMENT VARIABLES CHECK:"
echo "==============================="
echo "Make sure these are set in your Vercel deployment:"
echo ""
echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
echo "NEXT_PUBLIC_APP_ENV=production"
echo "NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app"
echo ""

echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Apply the database fixes using the SQL script"
echo "2. Verify your Vercel environment variables"
echo "3. Redeploy your application if needed"
echo "4. Test the Calendar page functionality"
echo ""

echo "✅ Script completed! Follow the instructions above to fix your production database."

