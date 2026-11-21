import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type AuthUser = { sub: string; name: string; email?: string; isAdmin: boolean };

type Profile = { name: string; email?: string; emailVerified: boolean; at: number };

const PROFILE_TTL_MS = 10 * 60 * 1000;

const list = (value?: string) =>
  (value ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  private domain: string;
  private audience: string;
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  // Cache sub -> perfil, para no pedir /userinfo en cada mensaje.
  private profiles = new Map<string, Profile>();
  // Administradores: por correo VERIFICADO (ADMIN_EMAILS) o por id de cuenta (ADMIN_SUBS).
  private adminEmails = new Set(list(process.env.ADMIN_EMAILS));
  private adminSubs = new Set(list(process.env.ADMIN_SUBS));

  constructor() {
    this.domain = process.env.AUTH0_DOMAIN ?? '';
    this.audience = process.env.AUTH0_AUDIENCE ?? '';
    if (!this.domain || !this.audience) {
      throw new Error('Faltan AUTH0_DOMAIN y/o AUTH0_AUDIENCE en backend/.env');
    }
    this.jwks = createRemoteJWKSet(new URL(`https://${this.domain}/.well-known/jwks.json`));
    if (!this.adminEmails.size && !this.adminSubs.size) {
      this.logger.warn('Sin ADMIN_EMAILS ni ADMIN_SUBS: nadie podra usar el panel de administracion.');
    }
  }

  /** Valida el access token de Auth0 y devuelve quien es el usuario. */
  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `https://${this.domain}/`,
        audience: this.audience,
      });
      const sub = String(payload.sub);
      const p = await this.profile(sub, token);
      return { sub, name: p.name, email: p.email, isAdmin: this.isAdmin(sub, p) };
    } catch (e) {
      this.logger.warn(`Token rechazado: ${(e as Error).message}`);
      throw new UnauthorizedException('Token invalido');
    }
  }

  private isAdmin(sub: string, p: Pick<Profile, 'email' | 'emailVerified'>): boolean {
    if (this.adminSubs.has(sub.toLowerCase())) return true;
    const email = p.email?.toLowerCase();
    if (!email || !this.adminEmails.has(email)) return false;
    if (!p.emailVerified) {
      // Sin correo verificado cualquiera podria registrarse con el correo del admin.
      this.logger.warn(`El correo ${email} esta en ADMIN_EMAILS pero NO esta verificado en Auth0: acceso admin denegado.`);
      return false;
    }
    return true;
  }

  private async profile(sub: string, token: string): Promise<Profile> {
    const cached = this.profiles.get(sub);
    if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached;
    try {
      const res = await fetch(`https://${this.domain}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const info = (await res.json()) as { nickname?: string; name?: string; email?: string; email_verified?: boolean };
        const p: Profile = {
          name: (info.nickname || info.name || 'usuario').slice(0, 32),
          email: info.email,
          emailVerified: info.email_verified === true,
          at: Date.now(),
        };
        this.profiles.set(sub, p);
        return p;
      }
      this.logger.warn(`/userinfo respondio ${res.status}`);
    } catch (e) {
      this.logger.warn(`No se pudo leer /userinfo: ${(e as Error).message}`);
    }
    // Si falla, se usa el perfil viejo si existe. Un fallo NO se guarda en cache.
    return cached ?? { name: 'usuario', emailVerified: false, at: 0 };
  }
}
