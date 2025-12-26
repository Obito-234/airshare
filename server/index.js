import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// WebSocket server for signaling
const wss = new WebSocketServer({ 
  port: 3002,
  perMessageDeflate: false 
});

// Handle WebSocket errors
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

wss.on('listening', () => {
  console.log('WebSocket server is listening on port 3002');
});

const rooms = new Map(); // roomCode -> { peers: Set, createdAt: Date }

// Clean up expired rooms (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 3600000) { // 1 hour
      rooms.delete(code);
    }
  }
}, 60000); // Check every minute

const peerConnections = new Map(); // ws -> { roomCode, peerId }

wss.on('connection', (ws) => {
  let roomCode = null;
  let peerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'create-room':
          roomCode = data.roomCode;
          peerId = data.peerId;
          
          if (!rooms.has(roomCode)) {
            rooms.set(roomCode, {
              peers: new Map(), // peerId -> ws
              createdAt: Date.now()
            });
          }
          
          rooms.get(roomCode).peers.set(peerId, ws);
          peerConnections.set(ws, { roomCode, peerId });
          ws.send(JSON.stringify({ type: 'room-created', roomCode }));
          break;

        case 'join-room':
          roomCode = data.roomCode;
          peerId = data.peerId;
          
          if (!rooms.has(roomCode)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
          }
          
          rooms.get(roomCode).peers.set(peerId, ws);
          peerConnections.set(ws, { roomCode, peerId });
          
          // Notify other peers in the room
          rooms.get(roomCode).peers.forEach((client, id) => {
            if (id !== peerId && client.readyState === 1) {
              client.send(JSON.stringify({
                type: 'peer-joined',
                peerId: peerId,
                roomCode: roomCode
              }));
            }
          });
          
          ws.send(JSON.stringify({ type: 'room-joined', roomCode }));
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Relay signaling messages to other peers in the same room
          if (roomCode && rooms.has(roomCode)) {
            rooms.get(roomCode).peers.forEach((client, id) => {
              if (id !== peerId && client.readyState === 1) {
                client.send(JSON.stringify({
                  type: data.type,
                  ...data.payload
                }));
              }
            });
          }
          break;

        case 'leave-room':
          if (roomCode && rooms.has(roomCode)) {
            rooms.get(roomCode).peers.delete(peerId);
            if (rooms.get(roomCode).peers.size === 0) {
              rooms.delete(roomCode);
            }
          }
          peerConnections.delete(ws);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    const conn = peerConnections.get(ws);
    if (conn) {
      const { roomCode: rc, peerId: pid } = conn;
      if (rc && rooms.has(rc)) {
        rooms.get(rc).peers.delete(pid);
        if (rooms.get(rc).peers.size === 0) {
          rooms.delete(rc);
        }
      }
      peerConnections.delete(ws);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket server running on port 3002`);
});

