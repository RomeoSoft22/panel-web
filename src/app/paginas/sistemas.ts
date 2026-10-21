import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Rol, Sistema, mensajeError } from '../core/api';

interface FormSistema {
  id: number | null;
  codigo: string;
  nombre: string;
  descripcion: string;
  url_base: string;
  redirects: string;
  confidencial: boolean;
}

/** Sistemas cliente (ISTQB, FIRMA, ...): registro, URLs de retorno, secreto y roles. */
@Component({
  selector: 'pn-sistemas',
  imports: [FormsModule],
  template: `
    <div class="cabecera">
      <div>
        <h1>Sistemas</h1>
        <p class="ayuda">Cada sistema inicia sesión con identidad. Sus roles definen lo que cada usuario puede hacer en él.</p>
      </div>
      <button class="btn primario" (click)="abrir()">Nuevo sistema</button>
    </div>

    @if (aviso()) { <p class="alerta ok">{{ aviso() }}</p> }
    @if (error()) { <p class="alerta error">{{ error() }}</p> }

    @for (s of sistemas(); track s.id) {
      <section class="tarjeta">
        <div class="cabecera chica">
          <div>
            <h2>{{ s.codigo }} <span class="nombre">{{ s.nombre }}</span></h2>
            <p class="ayuda">{{ s.descripcion }}</p>
          </div>
          <div class="acciones">
            <span class="etiqueta" [class.activo]="s.activo" [class.baja]="!s.activo">{{ s.activo ? 'activo' : 'inactivo' }}</span>
            <span class="etiqueta">{{ s.confidencial ? 'con secreto' : 'público (PKCE)' }}</span>
            <span class="etiqueta azul">{{ s.usuarios ?? 0 }} usuarios</span>
          </div>
        </div>

        <dl class="datos">
          <dt>URL base</dt><dd>{{ s.url_base || '—' }}</dd>
          <dt>URLs de retorno</dt><dd>@for (r of s.redirect_uris; track r) { <div class="mono">{{ r }}</div> }</dd>
          <dt>client_id</dt><dd class="mono">{{ s.client_id }}</dd>
        </dl>

        <h3>Roles</h3>
        <div class="roles">
          @for (r of s.roles; track r.id) {
            <span class="rol">
              <strong>{{ r.codigo }}</strong> {{ r.nombre }} <span class="ayuda">· {{ r.matriculas ?? 0 }}</span>
              @if (!r.matriculas) { <button class="quitar" (click)="eliminarRol(r)" [attr.aria-label]="'Eliminar rol ' + r.codigo">×</button> }
            </span>
          } @empty { <span class="ayuda">Sin roles. Crea al menos uno para poder dar acceso.</span> }
        </div>
        <form class="nuevo-rol" (ngSubmit)="crearRol(s)">
          <input [name]="'codigo' + s.id" [(ngModel)]="rolNuevo[s.id].codigo" placeholder="Código (ej. ADMIN)" aria-label="Código del rol">
          <input [name]="'nombre' + s.id" [(ngModel)]="rolNuevo[s.id].nombre" placeholder="Nombre (ej. Administrador)" aria-label="Nombre del rol">
          <button class="btn" type="submit" [disabled]="!rolNuevo[s.id].codigo || !rolNuevo[s.id].nombre">Agregar rol</button>
        </form>

        <div class="acciones pie-sistema">
          <button class="btn" (click)="abrir(s)">Editar</button>
          @if (s.confidencial) { <button class="btn" (click)="regenerar(s)">Regenerar secreto</button> }
          @if (s.codigo !== 'PANEL') {
            <button class="btn" [class.peligro]="s.activo" (click)="alternar(s)">{{ s.activo ? 'Desactivar' : 'Activar' }}</button>
          }
        </div>
      </section>
    } @empty {
      @if (!error()) { <div class="spinner"></div> }
    }

    @if (form(); as f) {
      <div class="fondo-modal" (click)="form.set(null)">
        <form class="modal" (click)="$event.stopPropagation()" (ngSubmit)="guardar(f)">
          <h2>{{ f.id ? 'Editar ' + f.codigo : 'Nuevo sistema' }}</h2>
          @if (errorForm()) { <p class="alerta error">{{ errorForm() }}</p> }
          <div class="campos">
            <div class="campo">
              <label for="f-codigo">Código</label>
              <input id="f-codigo" name="codigo" [(ngModel)]="f.codigo" [disabled]="!!f.id" placeholder="FIRMA" required>
            </div>
            <div class="campo"><label for="f-nombre">Nombre</label><input id="f-nombre" name="nombre" [(ngModel)]="f.nombre" required></div>
            <div class="campo ancho"><label for="f-desc">Descripción</label><input id="f-desc" name="descripcion" [(ngModel)]="f.descripcion"></div>
            <div class="campo ancho">
              <label for="f-url">URL base</label>
              <input id="f-url" name="url_base" [(ngModel)]="f.url_base" placeholder="https://firma.juarezcampos.net">
              <span class="ayuda">Al cerrar sesión, identidad solo devuelve al usuario a direcciones de esta URL.</span>
            </div>
            <div class="campo ancho">
              <label for="f-redir">URLs de retorno (una por línea)</label>
              <textarea id="f-redir" name="redirects" [(ngModel)]="f.redirects" placeholder="https://firma.juarezcampos.net/callback"></textarea>
              <span class="ayuda">Deben coincidir exactamente con la que usa el sistema. Ninguna otra es aceptada.</span>
            </div>
            @if (!f.id) {
              <label class="check campo ancho">
                <input type="checkbox" name="confidencial" [(ngModel)]="f.confidencial">
                Tiene servidor propio (cliente con secreto). Desmárcalo solo para aplicaciones de navegador sin backend.
              </label>
            }
          </div>
          <div class="pie">
            <button type="button" class="btn" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn primario" [disabled]="guardando()">{{ f.id ? 'Guardar' : 'Crear sistema' }}</button>
          </div>
        </form>
      </div>
    }

    @if (secreto(); as sec) {
      <div class="fondo-modal">
        <div class="modal">
          <h2>Secreto de {{ sec.codigo }}</h2>
          <p class="alerta aviso">Cópialo ahora y guárdalo en el .env del sistema (IDENTIDAD_CLIENT_SECRET). No se volverá a mostrar.</p>
          <p class="ayuda">client_id</p>
          <div class="secreto mono">{{ sec.clientId }}</div>
          <p class="ayuda">client_secret</p>
          <div class="secreto mono">{{ sec.valor }}</div>
          <div class="pie">
            <button class="btn" (click)="copiar(sec.valor)">{{ copiado() ? 'Copiado' : 'Copiar secreto' }}</button>
            <button class="btn primario" (click)="secreto.set(null)">Ya lo guardé</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .cabecera.chica { margin-bottom: 10px; }
    .nombre { font-weight: 500; color: var(--muted); }
    h3 { font: 700 14px/1.2 var(--body); margin: 18px 0 8px; }
    .datos { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; font-size: 14px; }
    .datos dt { color: var(--muted); font-weight: 600; }
    .datos dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .roles { display: flex; flex-wrap: wrap; gap: 6px; }
    .rol { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; font-size: 13.5px; }
    .quitar { border: 0; background: none; color: var(--danger); font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; }
    .nuevo-rol { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .nuevo-rol input { flex: 1 1 160px; }
    .pie-sistema { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
  `,
})
export class SistemasPagina implements OnInit {
  private readonly api = inject(Api);

  protected readonly sistemas = signal<Sistema[]>([]);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly guardando = signal(false);
  protected readonly form = signal<FormSistema | null>(null);
  protected readonly errorForm = signal('');
  protected readonly secreto = signal<{ codigo: string; clientId: string; valor: string } | null>(null);
  protected readonly copiado = signal(false);
  protected rolNuevo: Record<number, { codigo: string; nombre: string }> = {};

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const lista = await this.api.sistemas();
      for (const s of lista) this.rolNuevo[s.id] ??= { codigo: '', nombre: '' };
      this.sistemas.set(lista);
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  abrir(s?: Sistema): void {
    this.errorForm.set('');
    this.form.set(s
      ? { id: s.id, codigo: s.codigo, nombre: s.nombre, descripcion: s.descripcion ?? '', url_base: s.url_base ?? '', redirects: s.redirect_uris.join('\n'), confidencial: s.confidencial }
      : { id: null, codigo: '', nombre: '', descripcion: '', url_base: '', redirects: '', confidencial: true });
  }

  async guardar(f: FormSistema): Promise<void> {
    this.guardando.set(true);
    this.errorForm.set('');
    const datos = {
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || null,
      url_base: f.url_base.trim() || null,
      redirect_uris: f.redirects.split(/\s+/).map(r => r.trim()).filter(Boolean),
    };
    try {
      if (f.id) {
        await this.api.actualizarSistema(f.id, datos);
        this.aviso.set(`Sistema ${f.codigo} actualizado.`);
      } else {
        const r = await this.api.crearSistema({ ...datos, codigo: f.codigo.trim(), confidencial: f.confidencial });
        this.aviso.set(`Sistema ${r.data.codigo} creado. Agrégale roles para poder dar acceso.`);
        if (r.client_secret) this.mostrarSecreto(r.data, r.client_secret);
      }
      this.form.set(null);
      await this.cargar();
    } catch (e) {
      this.errorForm.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async regenerar(s: Sistema): Promise<void> {
    if (!confirm(`¿Regenerar el secreto de ${s.codigo}? El secreto actual deja de funcionar de inmediato y hay que actualizar el .env del sistema.`)) return;
    try {
      this.mostrarSecreto(s, await this.api.regenerarSecreto(s.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async alternar(s: Sistema): Promise<void> {
    if (s.activo && !confirm(`¿Desactivar ${s.codigo}? Nadie podrá ingresar a ese sistema hasta reactivarlo.`)) return;
    try {
      await this.api.actualizarSistema(s.id, { activo: !s.activo });
      this.aviso.set(`Sistema ${s.codigo} ${s.activo ? 'desactivado' : 'activado'}.`);
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async crearRol(s: Sistema): Promise<void> {
    const r = this.rolNuevo[s.id];
    try {
      await this.api.crearRol(s.id, { codigo: r.codigo.trim(), nombre: r.nombre.trim() });
      this.rolNuevo[s.id] = { codigo: '', nombre: '' };
      this.aviso.set(`Rol agregado a ${s.codigo}.`);
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async eliminarRol(r: Rol): Promise<void> {
    if (!confirm(`¿Eliminar el rol ${r.codigo}?`)) return;
    try {
      await this.api.eliminarRol(r.id);
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async copiar(valor: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(valor);
      this.copiado.set(true);
    } catch {
      /* el usuario puede seleccionarlo a mano */
    }
  }

  private mostrarSecreto(s: Sistema, valor: string): void {
    this.copiado.set(false);
    this.secreto.set({ codigo: s.codigo, clientId: s.client_id, valor });
  }
}
