# 🚀 Quick Start Guide

Get your Sitter App running in both development and production environments in minutes!

## ⚡ One-Command Setup

```bash
# Run this single command to set up everything
npm run setup:env
```

This will:
- ✅ Create `.env.local` for development
- ✅ Create `.env.production` for production  
- ✅ Update `.gitignore` to protect your secrets
- ✅ Set up all necessary configuration files

## 🔧 Next Steps

### 1. Configure Development (2 minutes)

```bash
# Start your local Supabase
npx supabase start

# Copy the credentials to .env.local
# Then start development
npm run dev
```

### 2. Set Up Production (5 minutes)

1. **Create Supabase Production Project**:
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Create new project
   - Copy URL and anon key

2. **Update `.env.production`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
   NEXT_PUBLIC_APP_ENV=production
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

3. **Deploy**:
   ```bash
   # Deploy to Vercel (recommended)
   npx vercel --prod
   
   # Or use the deployment script
   npm run deploy:prod
   ```

## 🎯 What You Get

- **Development**: `http://localhost:3000` → Local Supabase
- **Production**: `https://yourdomain.com` → Production Supabase
- **Database Sync**: Scripts to keep environments in sync
- **Environment Validation**: Automatic checks for missing variables
- **Security**: Proper headers and environment isolation

## 📚 Full Documentation

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🆘 Need Help?

- Check the troubleshooting section in the deployment guide
- Ensure all environment variables are set correctly
- Verify your Supabase projects are active

Happy coding! 🎉
