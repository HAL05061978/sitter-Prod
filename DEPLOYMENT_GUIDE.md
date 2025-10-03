# Sitter App - Production Deployment Guide

This guide will help you set up a production environment with your domain while maintaining a development environment on localhost.

## 🏗️ Architecture Overview

- **Development Environment**: Local development with localhost Supabase
- **Production Environment**: Production domain with separate Supabase project
- **Database Sync**: Scripts to sync schema changes between environments

## 📋 Prerequisites

1. **Domain**: You have a domain ready for production
2. **Supabase Account**: Access to create multiple projects
3. **Hosting Platform**: Vercel, Netlify, or similar (recommended: Vercel)
4. **Node.js**: Version 18+ installed

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Run the environment setup script
npm run setup:env

# This will create:
# - .env.local (development)
# - .env.production (production)
# - Update .gitignore
```

### 2. Configure Development Environment

1. **Start your local Supabase instance**:
   ```bash
   npx supabase start
   ```

2. **Update `.env.local`** with your local Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
   NEXT_PUBLIC_APP_ENV=development
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Test development environment**:
   ```bash
   npm run dev
   ```

### 3. Set Up Production Environment

#### 3.1 Create Production Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project for production
3. Note down your production project URL and anon key

#### 3.2 Configure Production Environment

1. **Update `.env.production`** with your production credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
   NEXT_PUBLIC_APP_ENV=production
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

#### 3.3 Sync Database Schema

1. **Link to production project**:
   ```bash
   npx supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
   ```

2. **Sync your development schema to production**:
   ```bash
   npm run db:sync
   ```

### 4. Deploy to Production

#### Option A: Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel**:
   - Go to your project settings in Vercel dashboard
   - Add all variables from `.env.production`

4. **Configure custom domain**:
   - Add your domain in Vercel project settings
   - Update DNS records as instructed

#### Option B: Manual Deployment

1. **Build for production**:
   ```bash
   npm run build:prod
   ```

2. **Deploy the `.next` folder** to your hosting platform

3. **Set environment variables** in your hosting platform

### 5. Domain Configuration

1. **Update DNS settings** to point to your hosting platform
2. **Configure SSL certificate** (usually automatic with Vercel/Netlify)
3. **Test your domain** to ensure everything works

## 🔄 Database Management

### Syncing Changes from Development to Production

```bash
# Generate migration from current development state
npx supabase db diff --schema public > migrations/$(date +%Y%m%d%H%M%S)_sync_to_production.sql

# Apply to production
npx supabase db push --project-ref YOUR_PRODUCTION_PROJECT_REF
```

### Backing Up Production Database

```bash
# Create backup
npx supabase db dump --project-ref YOUR_PRODUCTION_PROJECT_REF > backup_$(date +%Y%m%d).sql
```

## 🛠️ Development Workflow

### Daily Development
```bash
# Start development server
npm run dev

# Your app runs on http://localhost:3000
# Connected to local Supabase instance
```

### Testing Production Build Locally
```bash
# Build and test production version locally
npm run build:prod
npm run start:prod
```

### Deploying Changes
```bash
# 1. Test locally
npm run dev

# 2. Build for production
npm run build:prod

# 3. Deploy
npm run deploy:prod
```

## 🔧 Environment-Specific Features

### Development Features
- Hot reloading
- Detailed error messages
- Local Supabase instance
- Debug logging enabled

### Production Features
- Optimized builds
- Minified code
- Production Supabase project
- Security headers
- Performance optimizations

## 📁 File Structure

```
sitter/
├── app/
│   └── lib/
│       └── supabase.ts          # Environment-aware Supabase client
├── scripts/
│   ├── setup-environments.sh    # Environment setup
│   ├── deploy-production.sh     # Production deployment
│   └── sync-database.sh         # Database synchronization
├── .env.local                   # Development environment
├── .env.production              # Production environment
├── env.local.example            # Development template
├── env.production.example       # Production template
├── next.config.js               # Next.js configuration
└── DEPLOYMENT_GUIDE.md          # This guide
```

## 🚨 Important Notes

1. **Never commit `.env.local` or `.env.production`** to version control
2. **Always test in development** before deploying to production
3. **Backup production database** before major schema changes
4. **Use environment variables** for all configuration
5. **Monitor your production environment** for errors and performance

## 🔍 Troubleshooting

### Common Issues

1. **Environment variables not loading**:
   - Check file names (`.env.local`, `.env.production`)
   - Restart your development server
   - Verify variable names start with `NEXT_PUBLIC_`

2. **Supabase connection issues**:
   - Verify URL and keys are correct
   - Check if Supabase project is active
   - Ensure RLS policies are configured

3. **Build failures**:
   - Run `npm run clean` to clear cache
   - Check for TypeScript errors: `npm run type-check`
   - Verify all dependencies are installed

### Getting Help

- Check the [Next.js documentation](https://nextjs.org/docs)
- Review [Supabase documentation](https://supabase.com/docs)
- Check your hosting platform's deployment guides

## 🎉 You're Ready!

Your production environment is now set up! You can:
- Develop locally with `npm run dev`
- Deploy to production with `npm run deploy:prod`
- Sync database changes with `npm run db:sync`

Happy coding! 🚀
