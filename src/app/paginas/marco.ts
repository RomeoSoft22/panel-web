import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../core/api';
import { Sesion } from '../core/sesion';

/** Marco del panel: menú lateral (o superior en móvil), administrador conectado y salida. */
@Component({
  selector: 'pn-marco',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="marco">
      <aside class="lateral">
        <div class="marca"><span class="marca-mark">JC</span><span>Juarez Campos<small>Panel de administración</small></span></div>
        <nav>
          @for (m of menu; track m.ruta) {
            <a [routerLink]="m.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: m.ruta === '/' }">{{ m.texto }}</a>
          }
        </nav>
        <div class="usuario">
          @if (admin(); as a) {
            <strong>{{ a.nombre }}</strong>
            <small>{{ a.correo }}</small>
          }
          <button class="btn chico" (click)="sesion.salir()">Cerrar sesión</button>
        </div>
      </aside>
      <main class="contenido"><router-outlet /></main>
    </div>
  `,
  styles: `
    .marco { min-height: 100%; display: grid; grid-template-columns: 1fr; }
    @media (min-width: 900px) { .marco { grid-template-columns: 240px 1fr; } }
    .lateral { background: var(--ink-2); color: #d5deea; padding: 18px 16px; display: flex; flex-direction: column; gap: 18px; }
    @media (min-width: 900px) { .lateral { position: sticky; top: 0; height: 100vh; padding: 24px 18px; } }
    .marca { display: flex; align-items: center; gap: 10px; font: 700 15px/1.1 var(--display); color: #fff; }
    .marca small { display: block; margin-top: 4px; font: 500 12px/1 var(--body); color: #8fa0b5; }
    .marca-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--blue); color: #fff; font: 800 14px/1 var(--display); }
    nav { display: flex; gap: 4px; flex-wrap: wrap; }
    @media (min-width: 900px) { nav { flex-direction: column; flex: 1; } }
    nav a { color: #c5cfdc; text-decoration: none; padding: 9px 12px; border-radius: 9px; font-weight: 600; font-size: 14.5px; }
    nav a:hover { background: rgba(255,255,255,.06); color: #fff; }
    nav a.activo { background: rgba(3,127,255,.2); color: #fff; }
    .usuario { display: grid; gap: 2px; font-size: 13.5px; }
    .usuario strong { color: #fff; }
    .usuario small { color: #8fa0b5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 8px; }
    .usuario .btn { background: transparent; color: #d5deea; border-color: rgba(255,255,255,.2); justify-self: start; }
    .usuario .btn:hover { background: rgba(255,255,255,.08); }
    .contenido { padding: 24px 16px 40px; min-width: 0; }
    @media (min-width: 900px) { .contenido { padding: 32px 36px 48px; } }
  `,
})
export class Marco implements OnInit {
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  protected readonly admin = signal<{ nombre: string; correo: string } | null>(null);

  protected readonly menu = [
    { ruta: '/', texto: 'Resumen' },
    { ruta: '/usuarios', texto: 'Usuarios' },
    { ruta: '/sistemas', texto: 'Sistemas' },
    { ruta: '/auditoria', texto: 'Auditoría' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      this.admin.set((await this.api.resumen()).admin);
    } catch {
      /* el resumen muestra su propio error */
    }
  }
}
