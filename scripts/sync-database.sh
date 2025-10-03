#!/bin/bash

# Database Sync Script
# This script helps sync your development database schema to production

set -e

echo "🔄 Database synchronization script..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Function to sync to production
sync_to_production() {
    echo "🚀 Syncing database schema to production..."
    
    # Link to production project (you'll need to do this manually first)
    echo "📝 Please ensure you've linked to your production project:"
    echo "   supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF"
    
    # Generate migration from current state
    echo "📋 Generating migration from current development state..."
    supabase db diff --schema public > migrations/$(date +%Y%m%d%H%M%S)_sync_to_production.sql
    
    # Apply migration to production
    echo "🔄 Applying migration to production..."
    supabase db push --project-ref YOUR_PRODUCTION_PROJECT_REF
    
    echo "✅ Database sync completed!"
}

# Function to backup production
backup_production() {
    echo "💾 Creating production database backup..."
    
    # Create backup directory
    mkdir -p backups/$(date +%Y%m%d)
    
    # Dump production database
    supabase db dump --project-ref YOUR_PRODUCTION_PROJECT_REF > backups/$(date +%Y%m%d)/production_backup_$(date +%H%M%S).sql
    
    echo "✅ Production backup created in backups/$(date +%Y%m%d)/"
}

# Main menu
echo "What would you like to do?"
echo "1) Sync development schema to production"
echo "2) Backup production database"
echo "3) Exit"
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        sync_to_production
        ;;
    2)
        backup_production
        ;;
    3)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac
