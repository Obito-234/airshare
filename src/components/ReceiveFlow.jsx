import { useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../utils/webrtc';
import './ReceiveFlow.css';

function ReceiveFlow() {
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [files, setFiles] = useState([]);
  const [transferProgress, setTransferProgress] = useState({});
  const [transferSpeed, setTransferSpeed] = useState({});
  const [receivedFiles, setReceivedFiles] = useState([]);
  const webrtcRef = useRef(null);
  const fileBuffersRef = useRef({});
  const fileMetadataRef = useRef({});
  const progressStartTimeRef = useRef({});
  const currentFileRef = useRef(null); // Track which file we're currently receiving

  useEffect(() => {
    if (roomCode && !webrtcRef.current) {
      const peerId = `receiver-${Date.now()}`;
      webrtcRef.current = new WebRTCManager(
        roomCode,
        peerId,
        (state) => {
          console.log('Receiver connection state changed:', state);
          setIsConnected(state === 'connected');
          
          // Handle connection failures
          if (state === 'failed') {
            showErrorPopup(
              'Connection failed. Room code is incorrect or room is closed. Please try again.'
            );
          
            if (webrtcRef.current) {
              webrtcRef.current.disconnect();
              webrtcRef.current = null;
            }
          }
           else if (state === 'disconnected') {
            console.log('Connection disconnected');
          }
        },
        handleDataChannelMessage
      );
      webrtcRef.current.connect(false);
    }




    const showErrorPopup = (message) => {
      // Remove existing popup if any
      const existing = document.getElementById('error-popup');
      if (existing) existing.remove();
    
      // Overlay
      const overlay = document.createElement('div');
      overlay.id = 'error-popup';
      overlay.className = 'error-popup';
    
      // Content
      const content = document.createElement('div');
      content.className = 'error-popup-content';
    
      const text = document.createElement('p');
      text.textContent = message;
    
      const button = document.createElement('button');
      button.textContent = 'OK';
    
      button.onclick = () => overlay.remove();
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };
    
      content.appendChild(text);
      content.appendChild(button);
      overlay.appendChild(content);
      document.body.appendChild(overlay);
    };
    




    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
      }
      // Reset state when disconnecting
      currentFileRef.current = null;
      fileBuffersRef.current = {};
      fileMetadataRef.current = {};
    };
  }, [roomCode]);

  const handleDataChannelMessage = (event) => {
    // Check if data is a string (JSON metadata/control messages)
    if (typeof event.data === 'string') {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'file-metadata') {
          handleFileMetadata(data);
        } else if (data.type === 'file-complete') {
          handleFileComplete();
        }
      } catch (e) {
        console.error('Error parsing JSON message:', e);
      }
      return;
    }

    // Handle binary file data (ArrayBuffer or Blob)
    if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
      handleFileChunk(event.data);
    }
  };

  const handleFileMetadata = (metadata) => {
    const fileName = metadata.name;
    // Set this as the current file we're receiving
    currentFileRef.current = fileName;
    
    fileMetadataRef.current[fileName] = {
      name: fileName,
      size: metadata.size,
      type: metadata.mimeType || 'application/octet-stream'
    };
    fileBuffersRef.current[fileName] = [];
    setTransferProgress(prev => ({ ...prev, [fileName]: 0 }));
    setTransferSpeed(prev => ({ ...prev, [fileName]: 0 }));
    progressStartTimeRef.current[fileName] = Date.now();
    
    // Only add to files list if not already there
    setFiles(prev => {
      if (!prev.includes(fileName)) {
        return [...prev, fileName];
      }
      return prev;
    });
  };

  const handleFileChunk = (chunk) => {
    // Use the current file we're receiving
    const currentFile = currentFileRef.current;
    
    if (!currentFile || !fileMetadataRef.current[currentFile] || !fileBuffersRef.current[currentFile]) {
      console.warn('Received chunk but no current file set');
      return;
    }

    // Check if this file is already complete
    const received = fileBuffersRef.current[currentFile].reduce((sum, b) => sum + b.byteLength, 0);
    const total = fileMetadataRef.current[currentFile].size;
    
    if (received >= total) {
      // This file is already complete, wait for next file metadata
      console.warn(`File ${currentFile} already complete, ignoring chunk`);
      return;
    }

    fileBuffersRef.current[currentFile].push(chunk);
    
    const newReceived = fileBuffersRef.current[currentFile].reduce((sum, b) => sum + b.byteLength, 0);
    const progress = (newReceived / total) * 100;
    
    setTransferProgress(prev => ({ ...prev, [currentFile]: progress }));

    // Calculate speed
    const now = Date.now();
    const timeElapsed = (now - progressStartTimeRef.current[currentFile]) / 1000;
    if (timeElapsed > 0) {
      const speed = newReceived / timeElapsed;
      setTransferSpeed(prev => ({
        ...prev,
        [currentFile]: formatSpeed(speed)
      }));
    }
  };

  const handleFileComplete = () => {
    // Use the current file that just completed
    const completedFile = currentFileRef.current;
    
    if (!completedFile) {
      console.warn('File complete signal received but no current file');
      return;
    }

    // Verify the file is actually complete
    const received = fileBuffersRef.current[completedFile]?.reduce((sum, b) => sum + b.byteLength, 0) || 0;
    const total = fileMetadataRef.current[completedFile]?.size || 0;
    
    if (received < total) {
      console.warn(`File ${completedFile} marked complete but only ${received}/${total} bytes received`);
      return;
    }

    // Check if we've already processed this file
    if (receivedFiles.includes(completedFile)) {
      console.log(`File ${completedFile} already processed`);
      return;
    }

    // Mark as received (file is ready for download, but don't auto-download)
    setReceivedFiles(prev => [...prev, completedFile]);
    
    // Reset current file for next file
    currentFileRef.current = null;
    
    // File is now ready - user can click download button when they want
    console.log(`File ${completedFile} received and ready for download`);
  };

  const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const handleRoomCodeSubmit = (e) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code && code.length === 6) {
      // Reset state before connecting
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
        webrtcRef.current = null;
      }
      setFiles([]);
      setTransferProgress({});
      setTransferSpeed({});
      setReceivedFiles([]);
      setIsConnected(false);
      currentFileRef.current = null;
      fileBuffersRef.current = {};
      fileMetadataRef.current = {};
      // The useEffect will handle the connection
    } else {
      alert('Please enter a valid 6-character room code.');
    }
  };

  const downloadFile = (fileName) => {
    const metadata = fileMetadataRef.current[fileName];
    const chunks = fileBuffersRef.current[fileName];
    if (chunks && metadata) {
      const blob = new Blob(chunks, { type: metadata.type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = metadata.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="receive-flow">
      <div className="receive-container">
        <div className="receive-header">
          <h2>Receive Files</h2>
        </div>

        {!roomCode ? (
          <form className="room-code-form" onSubmit={handleRoomCodeSubmit}>
            <label htmlFor="room-code-input">Enter Room Code</label>
            <div className="input-group">
              <input
                id="room-code-input"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength="6"
                className="room-code-input"
              />
              <button type="submit" className="connect-button">
                Connect
              </button>
            </div>
          </form>
        ) : (
          <div className="connection-status-section">
            <div className="connection-status">
              <div className={`status-indicator ${isConnected ? 'connected' : 'connecting'}`}></div>
              <span>
                {isConnected 
                  ? 'Connected to sender' 
                  : 'Connecting...'}
              </span>
            </div>
            <button 
              className="change-room-button"
              onClick={() => {
                setRoomCode('');
                setFiles([]);
                setTransferProgress({});
                setTransferSpeed({});
                setReceivedFiles([]);
                currentFileRef.current = null;
                fileBuffersRef.current = {};
                fileMetadataRef.current = {};
                if (webrtcRef.current) {
                  webrtcRef.current.disconnect();
                  webrtcRef.current = null;
                }
              }}
            >
              Change Room Code
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="receiving-files">
            <h3>Receiving Files ({files.length})</h3>
            {files.map((fileName, index) => {
              const metadata = fileMetadataRef.current[fileName];
              const progress = transferProgress[fileName] || 0;
              const isComplete = receivedFiles.includes(fileName);
              
              return (
                <div key={index} className="receiving-file-item">
                  <div className="file-info">
                    <span className="file-name">{fileName}</span>
                    {metadata && (
                      <span className="file-size">
                        {(metadata.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                  {progress > 0 && (
                    <div className="file-progress">
                      <div className="progress-bar">
                        <div 
                          className={`progress-fill ${isComplete ? 'complete' : ''}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="progress-info">
                        <span>{progress.toFixed(1)}%</span>
                        {transferSpeed[fileName] && !isComplete && (
                          <span className="transfer-speed">{transferSpeed[fileName]}</span>
                        )}
                        {isComplete && (
                          <span className="transfer-complete">Complete</span>
                        )}
                      </div>
                    </div>
                  )}
                  {isComplete && (
                    <button 
                      className="download-button"
                      onClick={() => downloadFile(fileName)}
                    >
                      Download
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isConnected && files.length === 0 && (
          <div className="waiting-message">
            <div className="spinner"></div>
            <p>Waiting for files to be sent...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceiveFlow;

