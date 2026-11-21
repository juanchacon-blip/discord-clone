import { Injectable, Logger } from '@nestjs/common';
import { unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { UPLOAD_DIR } from '../channels/uploads';

/**
 * Almacenamiento PROPIO del proyecto: de aqui salen las fotos que ve todo el chat.
 *  - Si hay SUPABASE_URL + SUPABASE_SERVICE_KEY -> Supabase Storage (gratis, 1 GB, persistente).
 *  - Si no -> carpeta local uploads/ (sirve para desarrollo; en Render gratis se borra al reiniciar).
 * Para cambiar de proveedor (Cloudflare R2, Cloudinary...) solo hay que tocar este archivo.
 */
@Injectable()
export class StorageService {
  private logger = new Logger(StorageService.name);
  private url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  private key = process.env.SUPABASE_SERVICE_KEY ?? '';
  private bucket = process.env.SUPABASE_BUCKET || 'chat-files';

  constructor() {
    if (this.remote) {
      this.logger.log(`Archivos en Supabase Storage (bucket "${this.bucket}")`);
    } else {
      this.logger.warn('Sin SUPABASE_URL/SUPABASE_SERVICE_KEY: los archivos se guardan en disco local (se pierden al reiniciar en hostings gratis).');
    }
  }

  private get remote() {
    return Boolean(this.url && this.key);
  }

  /** Guarda el archivo y devuelve la URL con la que el navegador lo mostrara. */
  async save(storageKey: string, data: Buffer, contentType: string): Promise<string> {
    if (!this.remote) {
      await writeFile(join(UPLOAD_DIR, storageKey), data);
      return `/uploads/${storageKey}`;
    }
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${storageKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
        apikey: this.key,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new Error(`Supabase Storage respondio ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    // El bucket debe ser PUBLICO para que las URLs funcionen en <img>.
    return `${this.url}/storage/v1/object/public/${this.bucket}/${storageKey}`;
  }

  /**
   * Borra un archivo a partir de la URL guardada en el mensaje.
   * Si ya no existe se considera borrado. Si el almacenamiento falla, lanza error.
   */
  async remove(fileUrl: string): Promise<void> {
    // Archivo en disco local (subidas antiguas o modo desarrollo)
    if (fileUrl.startsWith('/uploads/')) {
      await unlink(join(UPLOAD_DIR, basename(fileUrl))).catch((e) => {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      });
      return;
    }
    const prefix = `${this.url}/storage/v1/object/public/${this.bucket}/`;
    if (!this.remote || !fileUrl.startsWith(prefix)) {
      this.logger.warn(`No se sabe borrar este archivo (no es de este almacenamiento): ${fileUrl.slice(0, 80)}`);
      return;
    }
    const key = fileUrl.slice(prefix.length);
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.key}`, apikey: this.key },
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404 || /not.?found/i.test(body)) return;
      throw new Error(`Supabase Storage respondio ${res.status}: ${body.slice(0, 200)}`);
    }
  }
}
