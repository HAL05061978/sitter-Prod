#!/bin/bash

# Deploy Supabase Edge Function for Group Invitations
echo "🚀 Deploying Supabase Edge Function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if user is logged in
if ! supabase status &> /dev/null; then
    echo "🔐 Please login to Supabase..."
    supabase login
fi

# Deploy the function
echo "📦 Deploying send-group-invite function..."
supabase functions deploy send-group-invite

if [ $? -eq 0 ]; then
    echo "✅ Edge Function deployed successfully!"
    echo "📧 Group invitation emails are now enabled in production!"
else
    echo "❌ Failed to deploy Edge Function"
    exit 1
fi

echo "🎉 Setup complete! Test your invitation system now."




