import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Matricula, Sistema, Usuario, mensajeError } from '../core/api';

/** Ficha del usuario: datos, estado de la cuenta, accesos a sistemas y sesiones recientes (desde dónde entró). */
@Component({
  selector: 'pn-usuario-detalle',
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <a routerLink="/usuarios" class="volver">← Usuarios</a>
    @if (aviso()) { <p class="alerta ok">{{ aviso() }}</p> }
    @if (error()) { <p class="alerta error">{{ error() }}</p> }

    @if (u(); as u) {
      <div class="cabecera">
        <div>
          <h1>{{ u.nombres }} {{ u.apellidos }}</h1>
          <p class="ayuda">{{ u.correo }} · <span class="etiqueta" [class]="u.estado">{{ u.estado }}</span></p>
        </div>
        <div class="acciones">
          @if (u.estado === 'bloqueado') { <button class="btn primario" (click)="desbloquear()">Desbloquear</button> }
          <button class="btn" (click)="claveAbierta.set(true)">Cambiar contraseña</button>
          <button class="btn" (click)="cerrarSesiones()">Cerrar sus sesiones</button>
          @if (u.estado === 'baja') {
            <button class="btn" (click)="cambiarEstado('activo')">Reactivar</button>
          } @else {
            <button class="btn peligro" (click)="cambiarEstado('baja')">Dar de baja</button>
          }
        </div>
      </div>

      @if (u.estado === 'bloqueado') {
        <p class="alerta aviso">Cuenta bloqueada el {{ u.bloqueado_en | date: 'medium' }} tras {{ u.intentos_fallidos }} intentos fallidos.
          El usuario también puede desbloquearla con el código que recibe en su correo al ingresar su contraseña correcta.</p>
      }

      <section class="tarjeta">
        <h2>Acceso a sistemas</h2>
        <div class="tabla-scroll">
          <table>
            <thead><tr><th>Sistema</th><th>Rol</th><th>Estado</th><th>Vence</th><th>Última visita</th><th></th></tr></thead>
            <tbody>
              @for (m of u.matriculas; track m.id) {
                <tr>
                  <td><strong>{{ m.sistema?.codigo }}</strong><div class="ayuda">{{ m.sistema?.nombre }}</div></td>
                  <td>{{ m.rol?.nombre }} <span class="ayuda mono">{{ m.rol?.codigo }}</span></td>
                  <td><span class="etiqueta" [class]="m.estado">{{ m.estado }}</span></td>
                  <td>{{ m.vigente_hasta ? (m.vigente_hasta | date: 'mediumDate') : 'Sin vencimiento' }}</td>
                  <td>{{ m.ultimo_acceso_en ? (m.ultimo_acceso_en | date: 'short') : 'Nunca' }}</td>
                  <td class="acciones">
                    @if (m.estado === 'activa') {
                      <button class="btn chico" (click)="cambiarMatricula(m, 'suspendida')">Suspender</button>
                      <button class="btn chico peligro" (click)="cambiarMatricula(m, 'retirada')">Retirar</button>
                    } @else {
                      <button class="btn chico" (click)="cambiarMatricula(m, 'activa')">Reactivar</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="vacio">Todavía no tiene acceso a ningún sistema.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <form class="asignar" (ngSubmit)="matricular()">
          <div class="campo">
            <label for="a-sistema">Sistema</label>
            <select id="a-sistema" name="sistema" [(ngModel)]="sistemaId" (ngModelChange)="rolId = null">
              <option [ngValue]="null">Elige un sistema</option>
              @for (s of sistemas(); track s.id) { <option [ngValue]="s.id" [disabled]="!s.activo">{{ s.codigo }} · {{ s.nombre }}</option> }
            </select>
          </div>
          <div class="campo">
            <label for="a-rol">Rol</label>
            <select id="a-rol" name="rol" [(ngModel)]="rolId" [disabled]="!sistemaId">
              <option [ngValue]="null">Elige un rol</option>
              @for (r of rolesDe(sistemaId); track r.id) { <option [ngValue]="r.id">{{ r.nombre }} ({{ r.codigo }})</option> }
            </select>
          </div>
          <div class="campo">
            <label for="a-vence">Vence (opcional)</label>
            <input id="a-vence" name="vence" type="date" [(ngModel)]="vence">
          </div>
          <button class="btn primario" type="submit" [disabled]="!rolId || guardando()">Dar acceso</button>
        </form>
      </section>

      <section class="tarjeta">
        <h2>Sesiones recientes</h2>
        <p class="ayuda">Desde dónde y con qué equipo ingresó. Horas en tu zona horaria.</p>
        <div class="tabla-scroll">
          <table>
            <thead><tr><th>Inicio</th><th>IP</th><th>Navegador</th><th>Sistema operativo</th><th>Equipo</th><th>Zona / idioma</th><th>Sistemas</th><th>Estado</th></tr></thead>
            <tbody>
              @for (s of u.sesiones ?? []; track s.id) {
                <tr>
                  <td>{{ s.iniciada_en | date: 'short' }}<div class="ayuda">Última actividad {{ s.ultima_actividad_en | date: 'shortTime' }}</div></td>
                  <td class="mono">{{ s.ip }}</td>
                  <td>{{ s.dispositivo?.navegador }} {{ s.dispositivo?.navegador_version }}</td>
                  <td>{{ s.dispositivo?.sistema_operativo }} {{ s.dispositivo?.so_version }}</td>
                  <td>{{ s.dispositivo?.tipo }}</td>
                  <td>{{ s.zona_horaria }}<div class="ayuda">{{ s.idioma }}</div></td>
                  <td>{{ s.accesos }}</td>
                  <td>
                    @if (s.vigente) { <span class="etiqueta activa">abierta</span> }
                    @else { <span class="etiqueta baja">{{ s.motivo_cierre ?? 'vencida' }}</span> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="vacio">Sin sesiones registradas.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Datos</h2>
        <form class="campos" (ngSubmit)="guardarDatos()">
          <div class="campo"><label for="d-nombres">Nombres</label><input id="d-nombres" name="nombres" [(ngModel)]="datos.nombres" required></div>
          <div class="campo"><label for="d-apellidos">Apellidos</label><input id="d-apellidos" name="apellidos" [(ngModel)]="datos.apellidos"></div>
          <div class="campo"><label for="d-correo">Correo</label><input id="d-correo" name="correo" type="email" [(ngModel)]="datos.correo" required></div>
          <div class="campo ancho"><button class="btn primario" type="submit" [disabled]="guardando()">Guardar datos</button></div>
        </form>
        <p class="ayuda">Creado el {{ u.creado_en | date: 'medium' }} · UUID <span class="mono">{{ u.uuid }}</span></p>
      </section>

      @if (claveAbierta()) {
        <div class="fondo-modal" (click)="claveAbierta.set(false)">
          <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="cambiarClave()">
            <h2>Cambiar contraseña</h2>
            <p class="ayuda">Se cerrarán todas sus sesiones abiertas en todos los sistemas.</p>
            <div class="campo"><label for="c-clave">Nueva contraseña</label>
              <input id="c-clave" name="clave" type="text" [(ngModel)]="nuevaClave" minlength="10" required autocomplete="new-password"></div>
            <div class="pie">
              <button type="button" class="btn" (click)="claveAbierta.set(false)">Cancelar</button>
              <button type="submit" class="btn primario" [disabled]="nuevaClave.length < 10 || guardando()">Cambiar</button>
            </div>
          </form>
        </div>
      }
    } @else if (!error()) {
      <div class="spinner"></div>
    }
  `,
  styles: `
    .volver { display: inline-block; margin-bottom: 14px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .asignar { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); align-items: end; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
    td.acciones { flex-wrap: nowrap; }
  `,
})
export class UsuarioDetallePagina implements OnInit {
  private readonly api = inject(Api);

  readonly id = input.required<string>();
  /** ?creado=1 al venir de "Nuevo usuario". */
  readonly creado = input<string>();

  protected readonly u = signal<Usuario | null>(null);
  protected readonly sistemas = signal<Sistema[]>([]);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly guardando = signal(false);
  protected readonly claveAbierta = signal(false);

  protected datos = { nombres: '', apellidos: '', correo: '' };
  protected sistemaId: number | null = null;
  protected rolId: number | null = null;
  protected vence = '';
  protected nuevaClave = '';

  protected readonly rolesPorSistema = computed(() => new Map(this.sistemas().map(s => [s.id, s.roles])));

  async ngOnInit(): Promise<void> {
    if (this.creado()) this.aviso.set('Usuario creado. Ahora dale acceso a los sistemas que necesite.');
    await this.cargar();
    try {
      this.sistemas.set(await this.api.sistemas());
    } catch {
      /* el formulario de acceso quedará sin opciones */
    }
  }

  rolesDe(sistemaId: number | null) {
    return sistemaId ? this.rolesPorSistema().get(sistemaId) ?? [] : [];
  }

  private async cargar(): Promise<void> {
    try {
      const u = await this.api.usuario(Number(this.id()));
      this.u.set(u);
      this.datos = { nombres: u.nombres, apellidos: u.apellidos ?? '', correo: u.correo };
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  private async accion(fn: () => Promise<unknown>, ok: string, confirmar?: string): Promise<void> {
    if (confirmar && !confirm(confirmar)) return;
    this.guardando.set(true);
    this.error.set('');
    this.aviso.set('');
    try {
      await fn();
      this.aviso.set(ok);
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  desbloquear() { return this.accion(() => this.api.desbloquear(this.u()!.id), 'Cuenta desbloqueada.'); }

  cerrarSesiones() {
    return this.accion(() => this.api.cerrarSesiones(this.u()!.id), 'Se cerraron todas sus sesiones.',
      '¿Cerrar todas las sesiones de este usuario en todos los sistemas?');
  }

  cambiarEstado(estado: 'activo' | 'baja') {
    return this.accion(() => this.api.actualizarUsuario(this.u()!.id, { estado }),
      estado === 'baja' ? 'Usuario dado de baja. Ya no puede ingresar a ningún sistema.' : 'Usuario reactivado.',
      estado === 'baja' ? '¿Dar de baja a este usuario? Perderá el acceso a todos los sistemas.' : undefined);
  }

  guardarDatos() { return this.accion(() => this.api.actualizarUsuario(this.u()!.id, this.datos), 'Datos guardados.'); }

  async cambiarClave(): Promise<void> {
    const clave = this.nuevaClave;
    this.claveAbierta.set(false);
    this.nuevaClave = '';
    await this.accion(() => this.api.cambiarContrasena(this.u()!.id, clave), 'Contraseña cambiada. Sus sesiones se cerraron.');
  }

  async matricular(): Promise<void> {
    const rolId = this.rolId!;
    await this.accion(
      () => this.api.matricular({ usuario_id: this.u()!.id, rol_id: rolId, vigente_hasta: this.vence ? `${this.vence} 23:59:59` : null }),
      'Acceso concedido. Vale desde su próximo ingreso al sistema.',
    );
    this.sistemaId = null;
    this.rolId = null;
    this.vence = '';
  }

  cambiarMatricula(m: Matricula, estado: 'activa' | 'suspendida' | 'retirada') {
    const textos = { activa: 'Acceso reactivado.', suspendida: 'Acceso suspendido.', retirada: 'Acceso retirado.' };
    return this.accion(() => this.api.actualizarMatricula(m.id, { estado }), `${textos[estado]} El cambio aplica en máximo 15 minutos.`,
      estado === 'activa' ? undefined : `¿${estado === 'suspendida' ? 'Suspender' : 'Retirar'} el acceso a ${m.sistema?.codigo}?`);
  }
}
