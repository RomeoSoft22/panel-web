import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { configuracion } from './configuracion';

interface RespuestaToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const CLAVE_LOGIN = 'panel.login';

/**
 * Sesión del panel con identidad.juarezcampos.net. El panel es un cliente OAuth público (una SPA
 * sin servidor propio): usa Authorization Code + PKCE y canjea el código directamente en identidad.
 * Los tokens viven solo en memoria; al recargar la página, la sesión SSO de identidad entrega un
 * código nuevo sin volver a pedir la contraseña.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly http = inject(HttpClient);
  private refreshToken: string | null = null;
  private renovacion?: ReturnType<typeof setTimeout>;
  private renovando: Promise<boolean> | null = null;

  readonly token = signal<string | null>(null);

  private get redirectUri(): string {
    return `${location.origin}/callback`;
  }

  /** Lleva al login de identidad; al volver, /callback completa el ingreso y regresa a `volver`. */
  async ingresar(volver = '/'): Promise<void> {
    const state = aleatorio(32);
    const verifier = aleatorio(64);
    sessionStorage.setItem(CLAVE_LOGIN, JSON.stringify({ state, verifier, volver }));

    const params = new URLSearchParams({
      client_id: configuracion().clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: '',
      state,
      code_challenge: await sha256Base64Url(verifier),
      code_challenge_method: 'S256',
    });
    location.assign(`${configuracion().identidadUrl}/authorize?${params}`);
  }

  /** Valida el state (anti-CSRF) y canjea el código con el code_verifier. Devuelve la ruta a la que volver. */
  async completar(code: string, state: string): Promise<string> {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_LOGIN) ?? 'null');
    sessionStorage.removeItem(CLAVE_LOGIN);
    if (!guardado || guardado.state !== state) {
      throw new Error('La respuesta de identidad no corresponde a este navegador. Vuelve a ingresar.');
    }
    await this.pedirToken(new HttpParams({
      fromObject: {
        grant_type: 'authorization_code',
        client_id: configuracion().clientId,
        redirect_uri: this.redirectUri,
        code,
        code_verifier: guardado.verifier,
      },
    }));
    const volver = String(guardado.volver || '/');
    return volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  }

  /** Renueva el access token con el refresh token (rotación). Varias llamadas a la vez comparten una sola. */
  renovar(): Promise<boolean> {
    if (!this.refreshToken) return Promise.resolve(false);
    this.renovando ??= this.pedirToken(new HttpParams({
      fromObject: { grant_type: 'refresh_token', client_id: configuracion().clientId, refresh_token: this.refreshToken },
    }))
      .then(() => true)
      .catch(() => {
        this.limpiar();
        return false;
      })
      .finally(() => (this.renovando = null));
    return this.renovando;
  }

  /** Cierra la sesión del panel y la de identidad (y con ello la de todos los sistemas). */
  salir(): void {
    this.limpiar();
    const destino = encodeURIComponent(`${location.origin}/`);
    location.assign(`${configuracion().identidadUrl}/logout?post_logout_redirect_uri=${destino}`);
  }

  limpiar(): void {
    clearTimeout(this.renovacion);
    this.token.set(null);
    this.refreshToken = null;
  }

  private async pedirToken(cuerpo: HttpParams): Promise<void> {
    const r = await firstValueFrom(
      this.http.post<RespuestaToken>(`${configuracion().identidadApiUrl}/oauth/token`, cuerpo.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      }),
    );
    this.token.set(r.access_token);
    this.refreshToken = r.refresh_token ?? null;
    clearTimeout(this.renovacion);
    // Renueva un minuto antes de que venza el JWT (15 minutos por defecto).
    this.renovacion = setTimeout(() => this.renovar(), Math.max(30, r.expires_in - 60) * 1000);
  }
}

/** Todas las páginas del panel exigen sesión; sin ella se va directo al login de identidad. */
export const sesionGuard: CanActivateFn = (_ruta, estado) => {
  const sesion = inject(Sesion);
  if (sesion.token()) return true;
  sesion.ingresar(estado.url);
  return false;
};

/** Agrega el JWT a /admin/* y, ante un 401, renueva una vez; si no se puede, vuelve a ingresar. */
export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(Sesion);
  if (!req.url.startsWith(`${configuracion().identidadApiUrl}/admin/`)) return next(req);

  const conToken = () => req.clone({ setHeaders: { Authorization: `Bearer ${sesion.token() ?? ''}` } });

  return next(conToken()).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
      return from(sesion.renovar()).pipe(
        switchMap(ok => {
          if (ok) return next(conToken());
          sesion.ingresar(location.pathname);
          return throwError(() => error);
        }),
      );
    }),
  );
};

function aleatorio(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256Base64Url(texto: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
