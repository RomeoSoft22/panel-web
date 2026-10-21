/** Direcciones de identidad y client_id del sistema PANEL, leídos de /config.json al arrancar. */
export interface Configuracion {
  /** identidad-web: pantallas /authorize y /logout. */
  identidadUrl: string;
  /** API de identidad: /oauth/token y /admin/*. */
  identidadApiUrl: string;
  /** client_id del sistema PANEL (cliente público: PKCE sin secreto). */
  clientId: string;
}

let actual: Configuracion | null = null;

export async function cargarConfiguracion(): Promise<void> {
  const r = await fetch('config.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('config.json');
  const c = (await r.json()) as Configuracion;
  actual = {
    identidadUrl: c.identidadUrl.replace(/\/+$/, ''),
    identidadApiUrl: c.identidadApiUrl.replace(/\/+$/, ''),
    clientId: c.clientId,
  };
}

export function configuracion(): Configuracion {
  if (!actual) throw new Error('Configuración no cargada');
  return actual;
}
