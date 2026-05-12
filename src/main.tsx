import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAmplitude, fetchFeatureVariants, restoreIdentity } from './utils/amplitude';

// Inicializar Amplitude
initAmplitude();

// Si en este dispositivo ya hubo una identificación previa por teléfono,
// la restauramos antes de mandar eventos. Así, si el usuario vuelve a abrir
// la app en el mismo navegador, sigue siendo el mismo user_id que en su
// primera sesión (y también el mismo user_id que tendrá en mobile con ese
// número de celular).
restoreIdentity();

// Cargar los feature flags ANTES de montar la app
fetchFeatureVariants().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
