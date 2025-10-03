#!/bin/bash

# Complete Setup Script for Sitter App
# This script sets up both development and production environments

set -e

echo "🎉 Welcome to Sitter App Setup!"
echo "This script will help you set up both development and production environments."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run the environment setup
echo "🔧 Setting up environments..."
npm run setup:env

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 🏠 Development Setup:"
echo "   - Start Supabase: npx supabase start"
echo "   - Update .env.local with your local Supabase credentials"
echo "   - Start dev server: npm run dev"
echo ""
echo "2. 🚀 Production Setup:"
echo "   - Create production Supabase project"
echo "   - Update .env.production with production credentials"
echo "   - Deploy: npm run deploy:prod"
echo ""
echo "3. 📖 Documentation:"
echo "   - Quick start: cat QUICK_START.md"
echo "   - Full guide: cat DEPLOYMENT_GUIDE.md"
echo ""
echo "🎉 You're all set! Happy coding!"
