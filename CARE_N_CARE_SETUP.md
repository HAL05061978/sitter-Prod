# Care-N-Care Production Setup Guide

## 🎯 Your Specific Setup

- **Domain**: `care-n-care.com`
- **Project Name**: `Care-N-Care`
- **Portfolio**: `C:\Users\admin\SitterAp\sitter` (keep everything here)

## 📋 Step-by-Step Instructions

### 1. 🔍 Find Your Supabase Project Reference

1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Click on your "Care-N-Care" project**
3. **Look at the URL in your browser** - it will look like:
   ```
   https://supabase.com/dashboard/project/abcdefghijklmnop
   ```
4. **Copy the project reference** (the part after `/project/`)

### 2. 📝 Create Your Production Environment File

1. **Copy the template**:
   ```bash
   copy env.production.example .env.production
   ```

2. **Edit `.env.production`** with your actual values:
   ```env
   # Production Environment Variables
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
   NODE_ENV=production
   NEXT_PUBLIC_APP_ENV=production
   NEXT_PUBLIC_APP_URL=https://care-n-care.com
   ```

### 3. 🗄️ Set Up Your Production Database

You have two options:

#### Option A: Use the Setup Script
```bash
npm run setup:env
scripts\setup-production-db.bat
```

#### Option B: Manual Setup
1. **Go to your Supabase project**
2. **Navigate to SQL Editor**
3. **Run your existing SQL files** (like `FIX_CALENDAR_RECIPROCAL_FILTERING.sql`)

### 4. 🚀 Deploy Your Application

#### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Add your domain in Vercel dashboard
```

#### Option B: Other Hosting
```bash
# Build for production
npm run build:prod

# Deploy the .next folder to your hosting platform
```

### 5. 🌐 Configure Your Domain

1. **In your hosting platform** (Vercel/Netlify):
   - Add `care-n-care.com` as a custom domain
   - Set up SSL certificate (usually automatic)

2. **In your domain registrar**:
   - Update DNS records to point to your hosting platform
   - Vercel will provide specific DNS instructions

## 🔍 Quick Verification

After setup, test these URLs:
- **Development**: `http://localhost:3000` (uses local Supabase)
- **Production**: `https://care-n-care.com` (uses production Supabase)

## 📁 Your File Structure

```
C:\Users\admin\SitterAp\sitter\
├── .env.local              # Development (localhost Supabase)
├── .env.production         # Production (care-n-care.com Supabase)
├── app\                    # Your Next.js app
├── scripts\                # Deployment scripts
└── DEPLOYMENT_GUIDE.md     # Full documentation
```

## 🆘 Common Issues

1. **Can't find project reference**: Look in the URL when you're in your Supabase project
2. **Database not syncing**: Make sure you're running the SQL files in the right order
3. **Domain not working**: Check DNS propagation (can take up to 24 hours)

## 🎉 You're All Set!

Once everything is configured:
- **Development**: `npm run dev` (localhost)
- **Production**: `https://care-n-care.com` (your domain)
