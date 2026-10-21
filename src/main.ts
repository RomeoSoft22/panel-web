import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { cargarConfiguracion } from './app/core/configuracion';

// config.json se lee antes de arrancar: así el mismo build sirve para local y producción
// (en cPanel solo se edita ese archivo, sin recompilar).
cargarConfiguracion()
  .then(() => bootstrapApplication(App, appConfig))
  .catch(() => {
    document.body.innerHTML =
      '<p style="font-family:system-ui;padding:32px">No se pudo cargar la configuración del panel (config.json). Avisa al administrador.</p>';
  });
