# Production Deployment Guide

This guide will help you deploy your Care-N-Care application to production so that real parents can use it.

## Quick Start

1. **Set up environment files:**
   ```bash
   npm run setup:env:new
   ```

2. **Configure your environment variables:**
   - Update `.env.local` with your development Supabase credentials
   - Update `.env.production` with your production Supabase credentials

3. **Deploy to production:**
   ```bash
   npm run prod
   ```

## Available Commands

### Development
- `npm run dev` - Start development server (localhost:3000)
- `npm run dev:prod` - Start development server with production environment

### Production
- `npm run prod` - Full production deployment with checks
- `npm run prod:quick` - Quick deployment to Vercel
- `npm run build:prod` - Build for production
- `npm run start:prod` - Start production server locally

### Setup
- `npm run setup:env:new` - Create environment files from templates
- `npm run setup:env` - Run existing environment setup
- `npm run setup:db` - Set up production database

## Environment Configuration

### Development (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_development_anon_key_here
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (.env.production)
```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key_here
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://care-n-care.com
```

## Prerequisites

1. **Vercel CLI** - Install with `npm install -g vercel`
2. **Supabase CLI** - Install with `npm install -g supabase`
3. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
4. **Supabase Project** - Set up at [supabase.com](https://supabase.com)

## Step-by-Step Deployment

### 1. First Time Setup

1. **Create environment files:**
   ```bash
   npm run setup:env:new
   ```

2. **Configure Supabase:**
   - Go to your Supabase dashboard
   - Copy your project URL and anon key
   - Update `.env.production` with these values

3. **Login to Vercel:**
   ```bash
   vercel login
   ```

### 2. Deploy to Production

1. **Run the production deployment:**
   ```bash
   npm run prod
   ```

2. **Follow the prompts:**
   - The script will check all prerequisites
   - Build your application
   - Deploy to Vercel
   - Provide you with the live URL

### 3. Post-Deployment

1. **Configure your domain** in Vercel dashboard
2. **Set up environment variables** in Vercel dashboard
3. **Deploy Supabase Edge Functions** if needed
4. **Configure SMTP settings** in Supabase dashboard
5. **Test all functionality** with real users

## Troubleshooting

### Common Issues

1. **Build fails:**
   - Check your `.env.production` file
   - Run `npm run type-check` to check for TypeScript errors
   - Ensure all dependencies are installed

2. **Deployment fails:**
   - Verify Vercel CLI is installed and you're logged in
   - Check your Vercel project settings
   - Ensure environment variables are set in Vercel dashboard

3. **App doesn't work in production:**
   - Verify all environment variables are correctly set
   - Check Supabase project is properly configured
   - Test database connections and API endpoints

### Getting Help

- Check the console output for specific error messages
- Review Vercel deployment logs in your dashboard
- Verify Supabase project status and configuration
- Test locally with production environment: `npm run dev:prod`

## Security Considerations

- Never commit `.env` files to version control
- Use strong, unique API keys
- Regularly rotate your Supabase anon keys
- Monitor your application for security issues
- Keep dependencies updated

## Monitoring

After deployment, monitor:
- Application performance
- Error rates
- User engagement
- Database performance
- API response times

Your production app will be available at the URL provided by Vercel after successful deployment.
