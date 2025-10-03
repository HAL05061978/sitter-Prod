# 🚀 Vercel Deployment Guide for Care-N-Care

This guide will help you deploy your Care-N-Care app to Vercel and connect it to your Bluehost domain.

## Prerequisites

- ✅ Vercel account created
- ✅ Bluehost domain (care-n-care.com)
- ✅ Supabase project set up
- ✅ Code ready for deployment

## Step 1: Install Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Verify installation
vercel --version
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI (Recommended)

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Deploy from your project directory**
   ```bash
   cd C:\Users\admin\SitterAp\sitter
   vercel
   ```

3. **Follow the prompts:**
   - Set up and deploy? **Yes**
   - Which scope? **Your personal account**
   - Link to existing project? **No**
   - Project name: **care-n-care** (or your preferred name)
   - Directory: **./** (current directory)
   - Override settings? **No**

4. **Deploy to production**
   ```bash
   vercel --prod
   ```

### Option B: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository (if connected) or upload files
4. Configure build settings:
   - Framework Preset: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project → Settings → Environment Variables
2. Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_APP_URL=https://care-n-care.com
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
```

## Step 4: Configure Your Bluehost Domain

### 4.1 Get Vercel DNS Records

1. In Vercel dashboard, go to your project → Settings → Domains
2. Add your domain: `care-n-care.com`
3. Vercel will show you DNS records to add

### 4.2 Update DNS in Bluehost

1. **Login to Bluehost cPanel**
2. **Go to DNS Zone Editor**
3. **Add these records:**

   **For root domain (care-n-care.com):**
   ```
   Type: A
   Name: @
   Value: 76.76.19.61
   TTL: 3600
   ```

   **For www subdomain:**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   TTL: 3600
   ```

4. **Wait for DNS propagation** (can take up to 24 hours, usually 1-2 hours)

## Step 5: Deploy Supabase Edge Functions

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Deploy Edge Functions:**
   ```bash
   # Login to Supabase
   supabase login
   
   # Link to your project
   supabase link --project-ref YOUR_PROJECT_REF
   
   # Deploy functions
   supabase functions deploy send-group-invite
   supabase functions deploy send-confirmation
   supabase functions deploy send-welcome
   ```

## Step 6: Configure SMTP for Email

1. **Choose an SMTP provider** (recommended: Resend)
2. **Get SMTP credentials**
3. **Add to Supabase Dashboard:**
   - Go to Authentication → Settings → SMTP
   - Enable custom SMTP
   - Enter your SMTP details

## Step 7: Test Your Deployment

1. **Visit your domain:** https://care-n-care.com
2. **Test signup flow:**
   - Go to `/signup`
   - Create a test account
   - Check email confirmation
3. **Test group invites:**
   - Create a group
   - Invite external email
   - Check email delivery

## Troubleshooting

### Common Issues:

1. **Build Errors:**
   - Check Vercel build logs
   - Ensure all dependencies are in package.json
   - Check for TypeScript errors

2. **Domain Not Working:**
   - Wait for DNS propagation
   - Check DNS records in Bluehost
   - Verify domain in Vercel dashboard

3. **Email Not Sending:**
   - Check SMTP configuration in Supabase
   - Verify Edge Functions are deployed
   - Check Supabase logs

4. **Environment Variables:**
   - Ensure all required variables are set
   - Check variable names match exactly
   - Redeploy after adding variables

## Post-Deployment Checklist

- [ ] Domain is accessible
- [ ] SSL certificate is active (automatic with Vercel)
- [ ] User signup works
- [ ] Email invitations work
- [ ] Group creation works
- [ ] Database connections work
- [ ] All pages load correctly

## Monitoring

1. **Vercel Analytics:** Monitor performance and errors
2. **Supabase Dashboard:** Monitor database and auth
3. **Email Provider:** Monitor email delivery rates

## Next Steps

1. **Set up monitoring:** Consider adding Sentry for error tracking
2. **Configure backups:** Set up database backups
3. **Performance optimization:** Monitor and optimize as needed
4. **Mobile app:** Plan for React Native/Expo mobile app

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Verify all environment variables
4. Test locally first

Your app should now be live at https://care-n-care.com! 🎉
