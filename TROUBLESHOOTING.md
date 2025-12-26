# Troubleshooting Guide

## Common Issues and Solutions

### Issue: "concurrently is not recognized"
**Solution:** Already fixed - the script now uses `npx concurrently`

### Issue: Application not opening / blank page

1. **Check if servers are running:**
   ```bash
   # Check if ports are in use
   netstat -ano | findstr :3000
   netstat -ano | findstr :3001
   netstat -ano | findstr :3002
   ```

2. **Run servers separately to see errors:**
   
   **Terminal 1 - Start the server:**
   ```bash
   npm run dev:server
   ```
   You should see: "Signaling server running on port 3001" and "WebSocket server running on port 3002"
   
   **Terminal 2 - Start the client:**
   ```bash
   npm run dev:client
   ```
   You should see: "Local: http://localhost:3000/"

3. **Check browser console:**
   - Open `http://localhost:3000` in your browser
   - Press F12 to open Developer Tools
   - Check the Console tab for any errors
   - Check the Network tab to see if files are loading

### Issue: QRCode import error

If you see an error about QRCode, try:
```bash
npm uninstall qrcode
npm install qrcode@1.5.3
```

### Issue: Port already in use

If ports 3000, 3001, or 3002 are already in use:
1. Close other applications using those ports
2. Or change the ports in:
   - `vite.config.js` (port 3000)
   - `server/index.js` (ports 3001 and 3002)

### Issue: Module not found errors

Try:
```bash
rm -rf node_modules
npm install
```

On Windows:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

## Getting Help

If you're still having issues, please provide:
1. The exact error message from the terminal
2. Any errors from the browser console (F12)
3. Your Node.js version: `node --version`
4. Your npm version: `npm --version`

