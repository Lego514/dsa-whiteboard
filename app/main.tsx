import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '../src/styles/base.css';
import '../src/styles/board.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
