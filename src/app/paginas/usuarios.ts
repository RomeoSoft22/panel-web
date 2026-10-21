import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, Pagina, Usuario, mensajeError } from '../core/api';

@Component({
  selector: 'pn-usuarios',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="cabecera">
      <div>
        <h1>Usuarios</h1>
        <p class="ayuda">Una sola cuenta por persona. Desde aquí se le da acceso a cada sistema con su rol.</p>
      </div>
      <button class="btn primario" (click)="abrirNuevo()">Nuevo usuario</button>
    </div>

    <form class="filtros" (ngSubmit)="buscar(1)">
      <input name="q" [(ngModel)]="q" placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios">
      <select name="estado" [(ngModel)]="filtroEstado" (change)="buscar(1)" aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        <option value="activo">Activos</option>
        <option value="bloqueado">Bloqueados</option>
        <option value="baja">De baja</option>
      </select>
      <button class="btn" type="submit">Buscar</button>
    </form>

    @if (error()) { <p class="alerta error">{{ error() }}</p> }

    <div class="tarjeta sin-relleno">
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Sistemas</th><th>Último ingreso</th></tr></thead>
          <tbody>
            @for (u of pagina()?.data ?? []; track u.id) {
              <tr class="click" (click)="abrir(u)" (keydown.enter)="abrir(u)" tabindex="0">
                <td><strong>{{ u.nombres }} {{ u.apellidos }}</strong></td>
                <td>{{ u.correo }}</td>
                <td><span class="etiqueta" [class]="u.estado">{{ u.estado }}</span></td>
                <td class="chips">
                  @for (m of u.matriculas; track m.id) {
                    @if (m.estado === 'activa') { <span class="etiqueta azul">{{ m.sistema?.codigo }} · {{ m.rol?.codigo }}</span> }
                  } @empty { <span class="ayuda">Sin acceso</span> }
                </td>
                <td>{{ u.ultimo_ingreso_en ? (u.ultimo_ingreso_en | date: 'short') : '—' }}<div class="ayuda mono">{{ u.ultima_ip }}</div></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="vacio">{{ cargando() ? 'Cargando…' : 'No hay usuarios con ese filtro.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if ((pagina()?.meta?.paginas ?? 1) > 1) {
      <div class="paginacion">
        <button class="btn chico" [disabled]="pagina()!.meta.pagina <= 1" (click)="buscar(pagina()!.meta.pagina - 1)">Anterior</button>
        <span>Página {{ pagina()!.meta.pagina }} de {{ pagina()!.meta.paginas }} · {{ pagina()!.meta.total }} usuarios</span>
        <button class="btn chico" [disabled]="pagina()!.meta.pagina >= pagina()!.meta.paginas" (click)="buscar(pagina()!.meta.pagina + 1)">Siguiente</button>
      </div>
    }

    @if (nuevoAbierto()) {
      <div class="fondo-modal" (click)="nuevoAbierto.set(false)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="crear()">
          <h2>Nuevo usuario</h2>
          <p class="ayuda">Después de crearlo, dale acceso a los sistemas que necesite.</p>
          @if (errorNuevo()) { <p class="alerta error">{{ errorNuevo() }}</p> }
          <div class="campos">
            <div class="campo"><label for="n-nombres">Nombres</label><input id="n-nombres" name="nombres" [(ngModel)]="nuevo.nombres" required></div>
            <div class="campo"><label for="n-apellidos">Apellidos</label><input id="n-apellidos" name="apellidos" [(ngModel)]="nuevo.apellidos"></div>
            <div class="campo ancho"><label for="n-correo">Correo</label><input id="n-correo" name="correo" type="email" [(ngModel)]="nuevo.correo" required autocomplete="off"></div>
            <div class="campo ancho">
              <label for="n-clave">Contraseña inicial</label>
              <input id="n-clave" name="contrasena" type="text" [(ngModel)]="nuevo.contrasena" required minlength="10" autocomplete="new-password">
              <span class="ayuda">Mínimo 10 caracteres. Entrégala por un canal seguro.</span>
            </div>
          </div>
          <div class="pie">
            <button type="button" class="btn" (click)="nuevoAbierto.set(false)">Cancelar</button>
            <button type="submit" class="btn primario" [disabled]="guardando()">{{ guardando() ? 'Creando…' : 'Crear usuario' }}</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .filtros { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .filtros input { flex: 1 1 260px; }
    .filtros select { flex: 0 1 200px; }
    .sin-relleno { padding: 0; overflow: hidden; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .paginacion { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; font-size: 14px; color: var(--muted); }
  `,
})
export class UsuariosPagina implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  /** ?estado=bloqueado desde el resumen. */
  readonly estado = input<string>('');

  protected q = '';
  protected filtroEstado = '';
  protected readonly pagina = signal<Pagina<Usuario> | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  protected readonly nuevoAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorNuevo = signal('');
  protected nuevo = { nombres: '', apellidos: '', correo: '', contrasena: '' };

  ngOnInit(): void {
    this.filtroEstado = this.estado() ?? '';
    this.buscar(1);
  }

  async buscar(page: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.pagina.set(await this.api.usuarios({ q: this.q.trim(), estado: this.filtroEstado, page }));
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(u: Usuario): void {
    this.router.navigate(['/usuarios', u.id]);
  }

  abrirNuevo(): void {
    this.nuevo = { nombres: '', apellidos: '', correo: '', contrasena: '' };
    this.errorNuevo.set('');
    this.nuevoAbierto.set(true);
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    this.errorNuevo.set('');
    try {
      const u = await this.api.crearUsuario(this.nuevo);
      this.nuevoAbierto.set(false);
      this.router.navigate(['/usuarios', u.id], { queryParams: { creado: 1 } });
    } catch (e) {
      this.errorNuevo.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
