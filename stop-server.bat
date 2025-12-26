@echo off
echo Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo Done! Ports should now be free.
echo You can now run: npm run dev:server
pause

