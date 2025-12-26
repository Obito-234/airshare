# FileShare - P2P File Sharing Application

A modern, web-based peer-to-peer file sharing application that allows users to instantly share files without account creation. Files are transferred directly between sender and receiver using WebRTC, ensuring privacy and speed.

## Features

- **Zero Account Required**: Share files instantly without registration
- **P2P Transfer**: Direct peer-to-peer file transfer using WebRTC (no server storage)
- **Room-Based Sharing**: Generate unique room codes and QR codes for easy access
- **Multiple Files**: Share one or multiple files simultaneously
- **Real-Time Progress**: Live transfer progress indicators and speed display
- **Drag & Drop**: Intuitive drag-and-drop file selection
- **Mobile Friendly**: Responsive design that works on all devices
- **Auto-Expiry**: Sessions automatically expire after transfer or timeout
- **Encrypted Transfer**: WebRTC provides built-in encryption for secure transfers

## Tech Stack

- **Frontend**: React 18 with Vite
- **Backend**: Node.js with Express
- **Signaling**: WebSocket (ws)
- **P2P**: WebRTC Data Channels
- **QR Codes**: qrcode library

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fileshare2
```

2. Install dependencies:
```bash
npm install
```

3. Start the development servers:
```bash
npm run dev
```

This will start:
- Frontend development server on `http://localhost:3000`
- Signaling server on `http://localhost:3001`
- WebSocket server on `ws://localhost:3002`

## Usage

### Share Files

1. Click "Share Files" on the home screen
2. Select files by dragging and dropping or clicking to browse
3. Share the room code or QR code with the receiver
4. Wait for the receiver to connect
5. Click "Start Transfer" to begin sending files
6. Keep the tab open during the transfer

### Receive Files

1. Click "Receive Files" on the home screen
2. Enter the room code provided by the sender, or scan the QR code
3. Wait for the connection to establish
4. Files will automatically download when the transfer completes

## Project Structure

```
fileshare2/
├── server/
│   └── index.js          # Signaling server
├── src/
│   ├── components/
│   │   ├── ShareFlow.jsx  # Share flow component
│   │   ├── ReceiveFlow.jsx # Receive flow component
│   │   └── *.css          # Component styles
│   ├── utils/
│   │   └── webrtc.js      # WebRTC connection manager
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # Entry point
│   └── *.css              # Global styles
├── index.html
├── package.json
└── vite.config.js
```

## How It Works

1. **Signaling**: The Node.js server handles WebRTC signaling (offer/answer/ICE candidates) but never sees the actual file data
2. **P2P Connection**: Once peers exchange signaling information, a direct WebRTC connection is established
3. **File Transfer**: Files are sent in chunks through WebRTC Data Channels directly between peers
4. **Progress Tracking**: Real-time progress and speed are calculated and displayed during transfer

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (with limitations)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security & Privacy

- Files are never stored on the server
- All file data is transferred directly between peers
- WebRTC provides built-in encryption
- Room codes expire after 1 hour of inactivity
- No user accounts or data collection

## Limitations

- Both peers must be online simultaneously
- NAT traversal may require TURN servers for some network configurations
- Large files may take time depending on network speed
- Mobile browsers may have limitations with large file transfers

## Development

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## License

MIT

## to run 
open two terminal 

1st terminal run
npm run dev:server

2nd terminal run
npm run dev:client