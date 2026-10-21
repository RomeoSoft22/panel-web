import { Routes } from '@angular/router';
import { sesionGuard } from './core/sesion';

export const routes: Routes = [
  { path: 'callback', title: 'Validando sesión · Panel', loadComponent: () => import('./paginas/callback').then(m => m.CallbackPagina) },
  {
    path: '',
    canActivate: [sesionGuard],
    loadComponent: () => import('./paginas/marco').then(m => m.Marco),
    children: [
      { path: '', title: 'Resumen · Panel', loadComponent: () => import('./paginas/resumen').then(m => m.ResumenPagina) },
      { path: 'usuarios', title: 'Usuarios · Panel', loadComponent: () => import('./paginas/usuarios').then(m => m.UsuariosPagina) },
      { path: 'usuarios/:id', title: 'Usuario · Panel', loadComponent: () => import('./paginas/usuario-detalle').then(m => m.UsuarioDetallePagina) },
      { path: 'sistemas', title: 'Sistemas · Panel', loadComponent: () => import('./paginas/sistemas').then(m => m.SistemasPagina) },
      { path: 'auditoria', title: 'Auditoría · Panel', loadComponent: () => import('./paginas/auditoria').then(m => m.AuditoriaPagina) },
    ],
  },
  { path: '**', redirectTo: '' },
];
