import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { configuracion } from './configuracion';

export interface Resumen {
  admin: { nombre: string; correo: string };
  usuarios: number;
  bloqueados: number;
  sistemas: number;
  sesiones_abiertas: number;
  ingresos_hoy: number;
  fallidos_hoy: number;
}

export interface Rol { id: number; codigo: string; nombre: string; descripcion: string | null; matriculas?: number | null }

export interface Sistema {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  url_base: string | null;
  activo: boolean;
  client_id: string;
  confidencial: boolean;
  redirect_uris: string[];
  usuarios: number | null;
  roles: Rol[];
}

export interface Matricula {
  id: number;
  sistema: { id: number; codigo: string; nombre: string } | null;
  rol: { id: number; codigo: string; nombre: string } | null;
  estado: 'activa' | 'suspendida' | 'retirada';
  vigente_hasta: string | null;
  ultimo_acceso_en: string | null;
}

export interface SesionUsuario {
  id: number;
  ip: string | null;
  zona_horaria: string | null;
  idioma: string | null;
  iniciada_en: string | null;
  ultima_actividad_en: string | null;
  cerrada_en: string | null;
  motivo_cierre: string | null;
  vigente: boolean;
  accesos: number;
  dispositivo: { navegador: string | null; navegador_version: string | null; sistema_operativo: string | null; so_version: string | null; tipo: string | null } | null;
}

export interface Usuario {
  id: number;
  uuid: string;
  nombres: string;
  apellidos: string | null;
  correo: string;
  estado: 'activo' | 'bloqueado' | 'baja';
  intentos_fallidos: number;
  bloqueado_en: string | null;
  bloqueado_motivo: string | null;
  ultimo_ingreso_en: string | null;
  ultima_ip: string | null;
  creado_en: string | null;
  matriculas: Matricula[];
  sesiones?: SesionUsuario[];
}

export interface Evento {
  id: number;
  evento: string;
  resultado: 'exito' | 'fallo' | 'denegado' | 'info';
  correo_intentado: string | null;
  sistema_codigo: string | null;
  actor_correo: string | null;
  ip: string | null;
  ip_reenviada: string | null;
  navegador: string | null;
  sistema_operativo: string | null;
  tipo_dispositivo: string | null;
  metodo_ruta: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
}

export interface Pagina<T> { data: T[]; meta: { total: number; pagina: number; paginas: number } }

/** Cliente de /api/admin/* de identidad (el JWT lo agrega sesionInterceptor). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private url(ruta: string): string {
    return `${configuracion().identidadApiUrl}/admin/${ruta}`;
  }

  private get<T>(ruta: string, filtros: Record<string, string | number | null | undefined> = {}): Promise<T> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    return firstValueFrom(this.http.get<T>(this.url(ruta), { params }));
  }

  private enviar<T>(metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.request<T>(metodo.toUpperCase(), this.url(ruta), { body: cuerpo }));
  }

  resumen() { return this.get<Resumen>('resumen'); }

  sistemas() { return this.get<{ data: Sistema[] }>('sistemas').then(r => r.data); }
  crearSistema(d: Partial<Sistema> & { confidencial: boolean }) { return this.enviar<{ data: Sistema; client_secret: string | null }>('post', 'sistemas', d); }
  actualizarSistema(id: number, d: Partial<Sistema>) { return this.enviar<{ data: Sistema }>('put', `sistemas/${id}`, d).then(r => r.data); }
  regenerarSecreto(id: number) { return this.enviar<{ client_secret: string }>('post', `sistemas/${id}/secreto`).then(r => r.client_secret); }
  crearRol(sistemaId: number, d: { codigo: string; nombre: string; descripcion?: string }) { return this.enviar<{ data: Rol }>('post', `sistemas/${sistemaId}/roles`, d).then(r => r.data); }
  eliminarRol(id: number) { return this.enviar<null>('delete', `roles/${id}`); }

  usuarios(filtros: { q?: string; estado?: string; page?: number }) { return this.get<Pagina<Usuario>>('usuarios', filtros); }
  usuario(id: number) { return this.get<{ data: Usuario }>(`usuarios/${id}`).then(r => r.data); }
  crearUsuario(d: { nombres: string; apellidos: string; correo: string; contrasena: string }) { return this.enviar<{ data: Usuario }>('post', 'usuarios', d).then(r => r.data); }
  actualizarUsuario(id: number, d: Partial<Pick<Usuario, 'nombres' | 'apellidos' | 'correo' | 'estado'>>) { return this.enviar<{ data: Usuario }>('put', `usuarios/${id}`, d).then(r => r.data); }
  desbloquear(id: number) { return this.enviar<{ data: Usuario }>('post', `usuarios/${id}/desbloquear`).then(r => r.data); }
  cambiarContrasena(id: number, contrasena: string) { return this.enviar<null>('post', `usuarios/${id}/contrasena`, { contrasena }); }
  cerrarSesiones(id: number) { return this.enviar<null>('post', `usuarios/${id}/cerrar-sesiones`); }

  matricular(d: { usuario_id: number; rol_id: number; vigente_hasta?: string | null }) { return this.enviar<unknown>('post', 'matriculas', d); }
  actualizarMatricula(id: number, d: { estado?: string; vigente_hasta?: string | null }) { return this.enviar<unknown>('put', `matriculas/${id}`, d); }

  auditoria(filtros: Record<string, string | number | null | undefined>) { return this.get<Pagina<Evento> & { eventos: string[] }>('auditoria', filtros); }
}

/** Mensaje entendible para el usuario. La API nunca envía detalles técnicos; a lo sumo una referencia. */
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con identidad. Revisa tu conexión e inténtalo de nuevo.';
    const cuerpo = (e.error ?? {}) as { message?: string; errors?: Record<string, string[]>; referencia?: string };
    if (cuerpo.errors) return Object.values(cuerpo.errors).flat()[0] ?? 'Revisa los datos ingresados.';
    if (e.status >= 500) {
      return 'Ocurrió un problema y no se pudo completar la operación. Inténtalo de nuevo en unos minutos.'
        + (cuerpo.referencia ? ` Si continúa, informa la referencia ${cuerpo.referencia}.` : '');
    }
    if (cuerpo.message) return cuerpo.message;
    return 'No se pudo completar la operación.';
  }
  return e instanceof Error ? e.message : 'No se pudo completar la operación.';
}
