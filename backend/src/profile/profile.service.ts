import { BadRequestException, ConflictException, HttpException, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Nombres que no se pueden elegir (para que nadie se haga pasar por el sistema o el administrador).
const RESERVED = new Set(['tu', 'admin', 'administrador', 'administrator', 'moderador', 'moderator', 'sistema', 'system', 'nebula', 'soporte']);
const VALID = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const COOLDOWN_MS = 3000;

/** "José" y "jose" tienen la misma clave: no puede haber dos nombres que solo se distingan por tildes o mayusculas. */
export const nameKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function validateName(raw: unknown): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 24) throw new BadRequestException('El nombre debe tener entre 2 y 24 caracteres');
  if (!VALID.test(name)) throw new BadRequestException('Usa solo letras, números, espacios y . _ -');
  if (RESERVED.has(nameKey(name))) throw new BadRequestException('Ese nombre está reservado');
  return name;
}

@Injectable()
export class ProfileService {
  private lastChange = new Map<string, number>();

  constructor(private prisma: PrismaService, private auth: AuthService) {}

  async get(sub: string) {
    const row = await this.prisma.profile.findUnique({ where: { sub } });
    return { custom: row?.displayName ?? null, defaultName: this.auth.defaultName(sub) };
  }

  async set(sub: string, raw: unknown): Promise<string> {
    this.throttle(sub);
    const name = validateName(raw);
    const key = nameKey(name);
    const clash = await this.prisma.profile.findUnique({ where: { nameKey: key } });
    if (clash && clash.sub !== sub) throw new ConflictException('Ese nombre ya está en uso');
    try {
      await this.prisma.profile.upsert({
        where: { sub },
        create: { sub, displayName: name, nameKey: key },
        update: { displayName: name, nameKey: key },
      });
    } catch (e) {
      // Dos personas eligiendo el mismo nombre en el mismo instante: gana una, la otra recibe este error.
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Ese nombre ya está en uso');
      throw e;
    }
    await this.apply(sub, name);
    return name;
  }

  /** Vuelve a usar el nombre de la cuenta de Auth0. */
  async clear(sub: string): Promise<string> {
    this.throttle(sub);
    await this.prisma.profile.deleteMany({ where: { sub } });
    const name = this.auth.defaultName(sub);
    await this.apply(sub, name, true);
    return name;
  }

  // Nombre nuevo valido al instante + tambien en los mensajes que esa cuenta ya habia enviado.
  private async apply(sub: string, name: string, cleared = false) {
    this.auth.setCustomName(sub, cleared ? null : name);
    await this.prisma.message.updateMany({ where: { authorSub: sub }, data: { author: name } });
  }

  private throttle(sub: string) {
    const now = Date.now();
    if (now - (this.lastChange.get(sub) ?? 0) < COOLDOWN_MS) {
      throw new HttpException('Espera unos segundos antes de volver a cambiar el nombre', 429);
    }
    this.lastChange.set(sub, now);
  }
}
