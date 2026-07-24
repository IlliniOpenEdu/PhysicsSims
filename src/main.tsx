import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Check that index.html has <div id="root">.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
