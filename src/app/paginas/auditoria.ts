import { DatePipe, JsonPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Evento, Pagina, mensajeError } from '../core/api';

/** Buscador de eventos de seguridad: ingresos, fallos, bloqueos, accesos y acciones del panel. */
@Component({
  selector: 'pn-auditoria',
  imports: [FormsModule, DatePipe, JsonPipe],
  template: `
    <div class="cabecera">
      <div>
        <h1>Auditoría</h1>
        <p class="ayuda">Cada ingreso, fallo, bloqueo y cambio queda registrado con IP, navegador y sistema operativo. Se conserva 12 meses.</p>
      </div>
    </div>

    <form class="filtros" (ngSubmit)="buscar(1)">
      <input name="q" [(ngModel)]="filtros.q" placeholder="Correo" aria-label="Correo">
      <input name="ip" [(ngModel)]="filtros.ip" placeholder="IP exacta" aria-label="IP">
      <select name="evento" [(ngModel)]="filtros.evento" aria-label="Evento">
        <option value="">Todos los eventos</option>
        @for (e of eventos(); track e) { <option [value]="e">{{ e }}</option> }
      </select>
      <select name="resultado" [(ngModel)]="filtros.resultado" aria-label="Resultado">
        <option value="">Todos los resultados</option>
        <option value="exito">Éxito</option>
        <option value="fallo">Fallo</option>
        <option value="denegado">Denegado</option>
        <option value="info">Información</option>
      </select>
      <button class="btn primario" type="submit">Buscar</button>
    </form>

    @if (error()) { <p class="alerta error">{{ error() }}</p> }

    <div class="tarjeta sin-relleno">
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Evento</th><th>Usuario</th><th>Sistema</th><th>IP</th><th>Navegador / SO</th><th>Detalle</th></tr></thead>
          <tbody>
            @for (e of pagina()?.data ?? []; track e.id) {
              <tr>
                <td>{{ e.creado_en | date: 'short' }}</td>
                <td><span class="etiqueta" [class]="e.resultado">{{ e.evento }}</span></td>
                <td>{{ e.correo_intentado ?? '—' }} @if (e.actor_correo) { <div class="ayuda">por {{ e.actor_correo }}</div> }</td>
                <td>{{ e.sistema_codigo ?? '—' }}</td>
                <td class="mono">{{ e.ip }} @if (e.ip_reenviada) { <div class="ayuda">{{ e.ip_reenviada }}</div> }</td>
                <td>{{ e.navegador }}<div class="ayuda">{{ e.sistema_operativo }} {{ e.tipo_dispositivo }}</div></td>
                <td class="mono detalle">{{ e.detalle ? (e.detalle | json) : '' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="vacio">{{ cargando() ? 'Cargando…' : 'No hay eventos con ese filtro.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if ((pagina()?.meta?.paginas ?? 1) > 1) {
      <div class="paginacion">
        <button class="btn chico" [disabled]="pagina()!.meta.pagina <= 1" (click)="buscar(pagina()!.meta.pagina - 1)">Anterior</button>
        <span>Página {{ pagina()!.meta.pagina }} de {{ pagina()!.meta.paginas }} · {{ pagina()!.meta.total }} eventos</span>
        <button class="btn chico" [disabled]="pagina()!.meta.pagina >= pagina()!.meta.paginas" (click)="buscar(pagina()!.meta.pagina + 1)">Siguiente</button>
      </div>
    }
  `,
  styles: `
    .filtros { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 16px; }
    .sin-relleno { padding: 0; overflow: hidden; }
    .detalle { max-width: 260px; white-space: pre-wrap; word-break: break-word; color: var(--muted); }
    .paginacion { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; font-size: 14px; color: var(--muted); }
  `,
})
export class AuditoriaPagina implements OnInit {
  private readonly api = inject(Api);

  /** ?evento=login_fallido desde el resumen. */
  readonly evento = input<string>('');

  protected filtros = { q: '', ip: '', evento: '', resultado: '' };
  protected readonly pagina = signal<Pagina<Evento> | null>(null);
  protected readonly eventos = signal<string[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.filtros.evento = this.evento() ?? '';
    this.buscar(1);
  }

  async buscar(page: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await this.api.auditoria({ ...this.filtros, page });
      this.pagina.set(r);
      this.eventos.set(r.eventos);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
