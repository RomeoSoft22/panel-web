# panel-web

Panel de administración de **panel.juarezcampos.net**: usuarios, sistemas, roles, accesos (matrículas), desbloqueos y auditoría de todos los sistemas de Juarez Campos.

Angular 21. No tiene servidor ni base propia: todo lo lee y escribe en la API de identidad (`/api/admin/*`, repositorio `RomeoSoft22/identidad`).

## Cómo inicia sesión

El panel es un sistema más de identidad, con código `PANEL`. Como es una aplicación de navegador sin backend, es un **cliente OAuth público**: usa Authorization Code + PKCE y canjea el código directamente en identidad, sin secreto.

- Los tokens viven solo en memoria. Al recargar, la sesión SSO de identidad entrega un código nuevo sin pedir la contraseña.
- Solo entran los usuarios con rol `ADMIN` en `PANEL`. Identidad revisa ese permiso en cada petición.

## Páginas

| Ruta | Para qué |
|---|---|
| `/` | Resumen: usuarios, bloqueados, sistemas, sesiones abiertas, ingresos y fallos de hoy. |
| `/usuarios` | Buscar, crear y abrir usuarios. |
| `/usuarios/:id` | Datos, desbloqueo, cambio de contraseña, baja, cierre de sesiones, acceso a sistemas y sesiones recientes (IP, navegador, sistema operativo, equipo). |
| `/sistemas` | Registrar sistemas, URLs de retorno, secreto (se muestra una sola vez) y roles. |
| `/auditoria` | Buscador de eventos por correo, IP, evento y resultado. |

## Configuración

`public/config.json` se lee al arrancar, así el mismo build sirve en cualquier entorno:

```json
{ "identidadUrl": "http://localhost:4300", "identidadApiUrl": "http://127.0.0.1:8001/api", "clientId": "<client_id de PANEL>" }
```

En producción usa `config.produccion.json` como base (con el `client_id` real de `PANEL`). En la API de identidad, `IDENTIDAD_CORS_ORIGENES` debe incluir el origen del panel.

## Desarrollo

Requiere la API de identidad en `http://127.0.0.1:8001` y identidad-web en `http://localhost:4300`.

```bash
npm install
npm start
```

Abre `http://localhost:4500`.

## Producción

```bash
npm run build
```

Publica `dist/panel-web/browser` como raíz de `panel.juarezcampos.net`, copia ahí `config.produccion.json` como `config.json` y agrega un `.htaccess` que mande toda ruta desconocida a `index.html` (rutas de Angular).
