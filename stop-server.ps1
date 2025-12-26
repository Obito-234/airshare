# Stop all Node.js processes
Write-Host "Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "Done! Ports should now be free." -ForegroundColor Green
Write-Host "You can now run: npm run dev:server" -ForegroundColor Cyan

