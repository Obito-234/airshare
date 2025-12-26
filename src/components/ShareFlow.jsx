import { useState, useRef, useEffect } from 'react';
import { WebRTCManager } from '../utils/webrtc';
import QRCode from 'qrcode';
import './ShareFlow.css';

function ShareFlow() {
  const [files, setFiles] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour in seconds
  const [isConnected, setIsConnected] = useState(false);
  const [transferProgress, setTransferProgress] = useState({});
  const [transferSpeed, setTransferSpeed] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const webrtcRef = useRef(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    // Generate room code on mount
    const code = generateRoomCode();
    setRoomCode(code);
    
    // Generate QR code
    // const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
    // QRCode.toDataURL(url, { width: 300, margin: 2 })
    //   .then(url => setQrCodeUrl(url))
    //   .catch(err => console.error(err));

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Session expired - disconnect and show message
          if (webrtcRef.current) {
            webrtcRef.current.disconnect();
          }
          alert('Session expired. Please create a new room.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Always connect when we have a room code, even without files
    if (roomCode && !webrtcRef.current) {
      const peerId = `sender-${Date.now()}`;
      webrtcRef.current = new WebRTCManager(
        roomCode,
        peerId,
        (state) => {
          console.log('Connection state changed:', state);
          setIsConnected(state === 'connected');
          
          // Auto-start transfer when receiver connects and we have files
          if (state === 'connected' && files.length > 0) {
            // Small delay to ensure data channel is ready
            setTimeout(() => {
              startTransfer();
            }, 500);
          }
          
          // Handle connection failures
          if (state === 'failed' || state === 'disconnected') {
            console.error('Connection failed or disconnected');
          }
        },
        null
      );
      webrtcRef.current.connect(true);
    }

    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
      }
    };
  }, [roomCode]);

  // Auto-start transfer when files are added and already connected
  useEffect(() => {
    if (isConnected && files.length > 0 && webrtcRef.current) {
      // Check if we're already transferring (progress > 0 for any file)
      const hasActiveTransfer = Object.values(transferProgress).some(p => p > 0 && p < 100);
      if (!hasActiveTransfer) {
        // Small delay to ensure everything is ready
        setTimeout(() => {
          startTransfer();
        }, 300);
      }
    }
  }, [isConnected, files.length]);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleFileSelect = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    setFiles(prev => [...prev, ...fileArray]);
    
    // Initialize progress tracking
    fileArray.forEach(file => {
      setTransferProgress(prev => ({ ...prev, [file.name]: 0 }));
      setTransferSpeed(prev => ({ ...prev, [file.name]: 0 }));
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files);
  };

  const removeFile = (fileName) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
    setTransferProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
    setTransferSpeed(prev => {
      const newSpeed = { ...prev };
      delete newSpeed[fileName];
      return newSpeed;
    });
  };

  const sendFileWithProgress = (file) => {
    return new Promise((resolve, reject) => {
      let lastProgress = 0;
      let lastTime = Date.now();
      
      const progressCallback = (current, total) => {
        const progress = (current / total) * 100;
        setTransferProgress(prev => ({ ...prev, [file.name]: progress }));
        
        // Calculate speed
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000; // seconds
        if (timeDiff > 0.1) { // Update speed every 100ms
          const bytesDiff = current - lastProgress;
          const speed = bytesDiff / timeDiff; // bytes per second
          
          setTransferSpeed(prev => ({
            ...prev,
            [file.name]: formatSpeed(speed)
          }));
          
          lastProgress = current;
          lastTime = now;
        }
      };

      const completeCallback = (success) => {
        if (success) {
          setTransferProgress(prev => ({ ...prev, [file.name]: 100 }));
          resolve();
        } else {
          reject(new Error('File transfer failed'));
        }
      };

      webrtcRef.current.sendFile(file, progressCallback, completeCallback);
    });
  };

  const startTransfer = async () => {
    if (!webrtcRef.current || !isConnected) {
      console.log('Waiting for receiver to connect...');
      return;
    }

    if (files.length === 0) {
      console.log('No files to transfer');
      return;
    }

    // Wait for data channel to be ready (with timeout)
    let attempts = 0;
    while ((!webrtcRef.current.dataChannel || 
           webrtcRef.current.dataChannel.readyState !== 'open') && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!webrtcRef.current.dataChannel || 
        webrtcRef.current.dataChannel.readyState !== 'open') {
      console.error('Data channel not ready after waiting');
      return;
    }

    // Send files sequentially
    for (const file of files) {
      // Check if this file is already being transferred or completed
      const currentProgress = transferProgress[file.name] || 0;
      if (currentProgress >= 100) {
        console.log(`File ${file.name} already transferred, skipping`);
        continue;
      }
      
      await sendFileWithProgress(file);
      // Small delay between files
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  


  const showCopyToast = (message = 'Room code copied') => {
    let toast = document.getElementById('copy-toast');
  
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copy-toast';
      toast.className = 'copy-toast';
      document.body.appendChild(toast);
    }
  
    toast.textContent = message;
  
    // Force reflow so animation works every time
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
  
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  };
  
  
  
  const copyRoomCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomCode);
        showCopyToast();
      } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
  
        document.execCommand('copy');
        document.body.removeChild(textArea);
  
        showCopyToast();
      }
    } catch (err) {
      console.error('Copy failed:', err);
      showCopyToast('Copy failed');
    }
  };
  
  return (
    <div className="share-flow">
      <div className="share-container">
        <div className="share-header">
          <h2>Share Files</h2>
          <div className="timer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            {formatTime(timeRemaining)}
          </div>
        </div>

        <div className="room-info">
          <div className="room-code-section">
            <label>Room Code</label>
            <div className="room-code-display">
              <span className="room-code">{roomCode}</span>
              <button className="copy-button" onClick={copyRoomCode}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>

          {qrCodeUrl && (
            <div className="qr-code-section">
              <label>Scan to Receive</label>
              <div className="qr-code-container">
                <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
              </div>
            </div>
          )}
        </div>

        <div
          className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p>Drag and drop files here or click to select</p>
          <span className="file-hint">You can select multiple files</span>
        </div>

        {files.length > 0 && (
          <div className="files-list">
            <h3>Selected Files ({files.length})</h3>
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                {transferProgress[file.name] !== undefined && transferProgress[file.name] > 0 && (
                  <div className="file-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${transferProgress[file.name]}%` }}
                      ></div>
                    </div>
                    <div className="progress-info">
                      <span>{transferProgress[file.name].toFixed(1)}%</span>
                      {transferSpeed[file.name] && (
                        <span className="transfer-speed">{transferSpeed[file.name]}</span>
                      )}
                    </div>
                  </div>
                )}
                <button className="remove-file" onClick={() => removeFile(file.name)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="transfer-controls">
            <div className="connection-status">
              <div className={`status-indicator ${isConnected ? 'connected' : 'waiting'}`}></div>
              <span>
                {isConnected 
                  ? 'Receiver connected - Transfer will start automatically' 
                  : `Waiting for receiver... (${files.length} file${files.length > 1 ? 's' : ''} ready)`}
              </span>
            </div>
            {isConnected && (
              <div className="auto-transfer-notice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Transfer will begin automatically
              </div>
            )}
          </div>
        )}

        <div className="share-warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <p>Keep this tab open during the transfer</p>
        </div>
      </div>
    </div>
  );
}

export default ShareFlow;

