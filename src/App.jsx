import { useState } from 'react';
import ShareFlow from './components/ShareFlow';
import ReceiveFlow from './components/ReceiveFlow';
import './App.css';

function App() {
  const [mode, setMode] = useState(null); // 'share' or 'receive'

  if (!mode) {
    return (
      <div className="app">
        <div className="mode-selector">
          <div className="mode-selector-content">
            <h1 className="app-title">AirShare</h1>
            <p className="app-subtitle">Instant file sharing</p>
            <div className="mode-buttons">
              <button 
                className="mode-button mode-button-share"
                onClick={() => setMode('share')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Share Files
              </button>
              <button 
                className="mode-button mode-button-receive"
                onClick={() => setMode('receive')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 16 12 21 17 16"></polyline>
                  <line x1="12" y1="21" x2="12" y2="9"></line>
                </svg>
                Receive Files
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <button className="back-button" onClick={() => setMode(null)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>
      {mode === 'share' && <ShareFlow />}
      {mode === 'receive' && <ReceiveFlow />}
    </div>
  );
}

export default App;

