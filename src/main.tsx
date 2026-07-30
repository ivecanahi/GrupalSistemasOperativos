// ============================================================
// PUNTO DE ENTRADA — Monta la aplicación React en el DOM
// ============================================================
// Carga los estilos globales (index.css) y renderiza el
// componente principal App dentro de StrictMode.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
