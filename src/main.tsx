import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeDatabase } from './db/repo';
import './styles/index.css';

async function boot() {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize ConbhanDB', error);
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
