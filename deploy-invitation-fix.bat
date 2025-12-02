@echo off
echo Deploying invitation fix to production...

REM Build and deploy
vercel --prod --yes

echo Deployment complete!
echo Test your invitation system at the production URL.
pause




