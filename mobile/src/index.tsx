import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { identify } from 'shared';

import './styles/index.css';

import App from './App';

identify();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
