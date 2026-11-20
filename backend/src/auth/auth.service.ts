import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type AuthUser = { sub: string; name: string };

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  private domain: string;
  private audience: string;
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  // Cache sub -> nombre visible, para no pedir /userinfo en cada mensaje.
  private names = new Map<string, string>();

  constructor() {
    this.domain = process.env.AUTH0_DOMAIN ?? '';
    this.audience = process.env.AUTH0_AUDIENCE ?? '';
    if (!this.domain || !this.audience) {
      throw new Error('Faltan AUTH0_DOMAIN y/o AUTH0_AUDIENCE en backend/.env');
    }
    this.jwks = createRemoteJWKSet(new URL(`https://${this.domain}/.well-known/jwks.json`));
  }

  /** Valida el access token de Auth0 y devuelve quien es el usuario. */
  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `https://${this.domain}/`,
        audience: this.audience,
      });
      const sub = String(payload.sub);
      return { sub, name: await this.displayName(sub, token) };
    } catch (e) {
      this.logger.warn(`Token rechazado: ${(e as Error).message}`);
      throw new UnauthorizedException('Token invalido');
    }
  }

  private async displayName(sub: string, token: string): Promise<string> {
    const cached = this.names.get(sub);
    if (cached) return cached;
    let name = 'usuario';
    try {
      const res = await fetch(`https://${this.domain}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const info = (await res.json()) as { nickname?: string; name?: string };
        name = (info.nickname || info.name || name).slice(0, 32);
      }
    } catch (e) {
      this.logger.warn(`No se pudo leer /userinfo: ${(e as Error).message}`);
    }
    this.names.set(sub, name);
    return name;
  }
}
