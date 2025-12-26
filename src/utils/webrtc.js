export class WebRTCManager {
  constructor(roomCode, peerId, onConnectionStateChange, onDataChannelMessage) {
    this.roomCode = roomCode;
    this.peerId = peerId;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onDataChannelMessage = onDataChannelMessage;
    this.peerConnection = null;
    this.dataChannel = null;
    this.ws = null;
    this.isSender = false;
  }

  connect(isSender = false) {
    this.isSender = isSender;
    // Use the current hostname and port for WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const currentPort = window.location.port;
    
    // Determine WebSocket port
    let wsPort = ':3002'; // Default WebSocket port
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // For host network, try to use the same port as the HTTP server
      // If port is 3000, WebSocket should be on 3002
      // Otherwise, use the same port (assuming WebSocket server is on same port)
      if (currentPort === '3000') {
        wsPort = ':3002';
      } else if (currentPort) {
        // Try same port, or fallback to 3002
        wsPort = `:${currentPort}`;
      } else {
        wsPort = ':3002';
      }
    }
    
    const wsUrl = `${protocol}//${hostname}${wsPort}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (isSender) {
        this.ws.send(JSON.stringify({
          type: 'create-room',
          roomCode: this.roomCode,
          peerId: this.peerId
        }));
      } else {
        this.ws.send(JSON.stringify({
          type: 'join-room',
          roomCode: this.roomCode,
          peerId: this.peerId
        }));
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'room-created':
        case 'room-joined':
          this.setupPeerConnection();
          break;
        case 'error':
          // Handle room not found or other errors
          if (this.onConnectionStateChange) {
            this.onConnectionStateChange('failed');
          }
          console.error('WebRTC error:', data.message);
          break;
        case 'peer-joined':
          if (this.isSender) {
            this.createDataChannel();
          }
          break;
        case 'offer':
          this.handleOffer(data);
          break;
        case 'answer':
          this.handleAnswer(data);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(data);
          break;
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange('failed');
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (event.code !== 1000) { // Not a normal closure
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange('disconnected');
        }
      }
    };
  }

  setupPeerConnection() {
    const configuration = {
      iceServers: [
        // STUN servers for NAT discovery
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Additional STUN servers
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voiparound.com' },
        { urls: 'stun:stun.voipbuster.com' },
        // TURN servers for NAT traversal (free public servers)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            roomCode: this.roomCode
          }
        }));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('Peer connection state:', state);
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
      
      // Handle connection failures
      if (state === 'failed' || state === 'disconnected') {
        console.error('WebRTC connection failed or disconnected');
        // Try to restart ICE
        if (state === 'failed') {
          this.peerConnection.restartIce();
        }
      }
    };

    // Log ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
      if (this.peerConnection.iceConnectionState === 'failed') {
        console.error('ICE connection failed - trying to restart');
        this.peerConnection.restartIce();
      }
    };

    // Log ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
    };

    if (!this.isSender) {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  createDataChannel() {
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    });
    this.setupDataChannel();
    this.createOffer();
  }

  setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      if (this.onDataChannelMessage) {
        this.onDataChannelMessage(event);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.ws.send(JSON.stringify({
        type: 'offer',
        payload: {
          offer: offer,
          roomCode: this.roomCode
        }
      }));
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(data) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.ws.send(JSON.stringify({
        type: 'answer',
        payload: {
          answer: answer,
          roomCode: this.roomCode
        }
      }));
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(data) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(data) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  sendFile(file, onProgress, onComplete) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('Data channel not ready');
      if (onComplete) onComplete(false);
      return;
    }

    const reader = new FileReader();
    const chunkSize = 64 * 1024; // 64KB chunks
    let offset = 0;

    // Send file metadata first
    const metadata = {
      type: 'file-metadata',
      name: file.name,
      size: file.size,
      mimeType: file.type
    };
    this.dataChannel.send(JSON.stringify(metadata));

    reader.onload = (e) => {
      const chunk = e.target.result;
      
      // Check if data channel is still open before sending
      if (this.dataChannel.readyState === 'open') {
        this.dataChannel.send(chunk);
        offset += chunk.byteLength;

        if (onProgress) {
          onProgress(offset, file.size);
        }

        if (offset < file.size) {
          readChunk();
        } else {
          // Send completion signal
          if (this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'file-complete' }));
          }
          if (onComplete) {
            setTimeout(() => onComplete(true), 100); // Small delay to ensure message is sent
          }
        }
      } else {
        if (onComplete) onComplete(false);
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      if (onComplete) onComplete(false);
    };

    const readChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    readChunk();
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.ws) {
      this.ws.send(JSON.stringify({
        type: 'leave-room',
        roomCode: this.roomCode,
        peerId: this.peerId
      }));
      this.ws.close();
    }
  }
}

