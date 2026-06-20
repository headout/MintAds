import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/ds/colors_and_type.css';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
