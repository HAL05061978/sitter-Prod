@echo off
echo Cleaning Next.js cache...
rmdir /s /q .next 2>nul
echo Starting development server...
npm run dev
pause

