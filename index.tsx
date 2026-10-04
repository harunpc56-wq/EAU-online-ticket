import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { db } from './services/db';
import { ThemeProvider } from './ThemeContext';

// Suppress/intercept benign WebSocket rejection errors from Vite HMR which are expected in the sandboxed preview
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = event.reason ? String(event.reason.message || event.reason) : '';
  if (reasonStr.includes('WebSocket') || reasonStr.includes('websocket')) {
    event.preventDefault();
    console.debug("Ignored expected sandboxed dev-server HMR connection event:", reasonStr);
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);

const fetchServerDb = async () => {
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const dbData = await res.json();
      if (dbData && Object.keys(dbData).length > 0) {
        db.hydrate(dbData);
        console.log("University database loaded successfully from SQLite database.");
      }
    }
  } catch (err) {
    console.warn("Failed to load SQLite backend database:", err);
  }
};

const bootSystem = async () => {
  try {
    // Load from SQLite / Cloud dual-database backend
    await fetchServerDb();
  } catch (error) {
    console.warn("Bootstrap load error, operating on client-side state:", error);
  } finally {
    // Sync-serialize once so memory represents persisted states
    db.serializeAndSyncAll();

    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </React.StrictMode>
    );
  }
};

bootSystem();