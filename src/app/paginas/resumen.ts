import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Resumen, mensajeError } from '../core/api';

@Component({
  selector: 'pn-resumen',
  imports: [RouterLink],
  template: `
    <div class="cabecera">
      <div>
        <h1>Resumen</h1>
        <p class="ayuda">Usuarios, sistemas y actividad de hoy en todos los sistemas de Juarez Campos.</p>
      </div>
    </div>
    @if (error()) { <p class="alerta error">{{ error() }}</p> }
    @if (datos(); as d) {
      <div class="cifras">
        <a class="tarjeta cifra" routerLink="/usuarios"><span>Usuarios</span><strong>{{ d.usuarios }}</strong></a>
        <a class="tarjeta cifra" routerLink="/usuarios" [queryParams]="{ estado: 'bloqueado' }" [class.alerta-cifra]="d.bloqueados > 0">
          <span>Cuentas bloqueadas</span><strong>{{ d.bloqueados }}</strong></a>
        <a class="tarjeta cifra" routerLink="/sistemas"><span>Sistemas activos</span><strong>{{ d.sistemas }}</strong></a>
        <div class="tarjeta cifra"><span>Sesiones abiertas</span><strong>{{ d.sesiones_abiertas }}</strong></div>
        <a class="tarjeta cifra" routerLink="/auditoria" [queryParams]="{ evento: 'acceso_sistema' }"><span>Ingresos hoy</span><strong>{{ d.ingresos_hoy }}</strong></a>
        <a class="tarjeta cifra" routerLink="/auditoria" [queryParams]="{ evento: 'login_fallido' }" [class.alerta-cifra]="d.fallidos_hoy > 0">
          <span>Intentos fallidos hoy</span><strong>{{ d.fallidos_hoy }}</strong></a>
      </div>
    } @else if (!error()) {
      <div class="spinner"></div>
    }
  `,
  styles: `
    .cifras { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
    .cifra { display: grid; gap: 6px; text-decoration: none; color: inherit; margin: 0 !important; }
    a.cifra:hover { border-color: #b9c7d6; }
    .cifra span { color: var(--muted); font-size: 13.5px; font-weight: 600; }
    .cifra strong { font: 800 30px/1 var(--display); }
    .alerta-cifra strong { color: var(--danger); }
  `,
})
export class ResumenPagina implements OnInit {
  private readonly api = inject(Api);
  protected readonly datos = signal<Resumen | null>(null);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.datos.set(await this.api.resumen());
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }
}
