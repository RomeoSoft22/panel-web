import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeError } from '../core/api';
import { Sesion } from '../core/sesion';

/** Destino de la redirección de identidad: canjea el código y vuelve a la página que se quería abrir. */
@Component({
  selector: 'pn-callback',
  template: `
    <main class="centro">
      <div class="tarjeta">
        @if (error()) {
          <h1>No se pudo iniciar sesión</h1>
          <p class="alerta error">{{ error() }}</p>
          <button class="btn primario" (click)="reintentar()">Volver a ingresar</button>
        } @else {
          <div class="spinner"></div>
          <p class="ayuda">Validando tu sesión…</p>
        }
      </div>
    </main>
  `,
  styles: `
    .centro { min-height: 100%; display: grid; place-items: center; padding: 16px; }
    .tarjeta { width: min(420px, 100%); display: grid; gap: 12px; justify-items: center; text-align: center; }
  `,
})
export class CallbackPagina implements OnInit {
  private readonly sesion = inject(Sesion);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    const p = this.ruta.snapshot.queryParamMap;
    const code = p.get('code');
    const state = p.get('state');
    if (p.get('error') || !code || !state) {
      this.error.set('Identidad no completó el ingreso. Vuelve a intentarlo.');
      return;
    }
    try {
      await this.router.navigateByUrl(await this.sesion.completar(code, state), { replaceUrl: true });
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  reintentar(): void {
    this.sesion.ingresar('/');
  }
}
