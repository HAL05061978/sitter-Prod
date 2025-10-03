#!/bin/bash

# Environment Setup Script
# This script helps set up development and production environments

set -e

echo "🔧 Setting up development and production environments..."

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp env.local.example .env.local
    echo "✅ .env.local created. Please update with your development Supabase credentials."
else
    echo "ℹ️  .env.local already exists."
fi

# Create .env.production if it doesn't exist
if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production from template..."
    cp env.production.example .env.production
    echo "✅ .env.production created. Please update with your production Supabase credentials."
else
    echo "ℹ️  .env.production already exists."
fi

# Create .gitignore entry for environment files
if ! grep -q ".env.local" .gitignore 2>/dev/null; then
    echo "📝 Adding environment files to .gitignore..."
    echo "" >> .gitignore
    echo "# Environment files" >> .gitignore
    echo ".env.local" >> .gitignore
    echo ".env.production" >> .gitignore
    echo "✅ .gitignore updated."
else
    echo "ℹ️  Environment files already in .gitignore."
fi

echo "🎉 Environment setup complete!"
echo "📋 Next steps:"
echo "   1. Update .env.local with your development Supabase credentials"
echo "   2. Create a production Supabase project"
echo "   3. Update .env.production with your production Supabase credentials"
echo "   4. Run 'npm run dev' to start development"
echo "   5. Run './scripts/deploy-production.sh' to deploy to production"
