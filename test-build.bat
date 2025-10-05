@echo off
echo Testing build process...
echo.

echo Cleaning cache...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo.
echo Running TypeScript check...
npx tsc --noEmit

echo.
echo Running Next.js build...
set NODE_ENV=production
npx next build

echo.
echo Build test complete!
pause
