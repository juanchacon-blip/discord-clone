import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { drive, drive_v3 } from '@googleapis/drive';
import { OAuth2Client } from 'google-auth-library';
import { jwtVerify, SignJWT } from 'jose';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, encrypt, stateSecret } from './crypto';

// drive.file = la app SOLO ve/toca los archivos que ella misma creo. No puede leer el resto del Drive.
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];
const FOLDER_NAME = 'Discord Clone - Respaldo';

@Injectable()
export class DriveService {
  private logger = new Logger(DriveService.name);
  // Evita crear dos carpetas si el usuario sube dos archivos a la vez la primera vez.
  private folderLocks = new Map<string, Promise<string>>();

  constructor(private prisma: PrismaService) {
    if (!this.enabled) this.logger.warn('Google Drive desactivado: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI / TOKEN_ENCRYPTION_KEY.');
  }

  get enabled(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI && process.env.TOKEN_ENCRYPTION_KEY,
    );
  }

  private client(): OAuth2Client {
    if (!this.enabled) throw new ServiceUnavailableException('Google Drive no esta configurado en el servidor');
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  }

  // ---------- Conexion (OAuth) ----------

  async authUrl(sub: string): Promise<string> {
    const state = await new SignJWT({ sub })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(stateSecret());
    return this.client().generateAuthUrl({
      access_type: 'offline',   // para recibir refresh_token
      prompt: 'consent',        // fuerza a Google a entregarlo siempre
      scope: SCOPES,
      state,
    });
  }

  /** Verifica el "state" firmado y devuelve a que cuenta pertenece este intento de conexion. */
  async subFromState(state: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(state, stateSecret());
      return String(payload.sub);
    } catch {
      throw new BadRequestException('state invalido o vencido');
    }
  }

  async connect(sub: string, code: string): Promise<void> {
    const client = this.client();
    const { tokens } = await client.getToken(code);
    // Con permisos granulares el usuario puede desmarcar Drive en la pantalla de Google.
    if (!tokens.scope?.includes('drive.file')) throw new BadRequestException('No se concedio el permiso de Drive');
    if (!tokens.refresh_token) throw new BadRequestException('Google no entrego refresh token');

    let email: string | undefined;
    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      email = ticket.getPayload()?.email;
    }
    await this.prisma.driveConnection.upsert({
      where: { sub },
      create: { sub, email, refreshToken: encrypt(tokens.refresh_token) },
      update: { email, refreshToken: encrypt(tokens.refresh_token), folderId: null },
    });
  }

  async status(sub: string) {
    if (!this.enabled) return { enabled: false, connected: false };
    const c = await this.prisma.driveConnection.findUnique({ where: { sub } });
    return { enabled: true, connected: Boolean(c), email: c?.email ?? null };
  }

  async isConnected(sub: string): Promise<boolean> {
    if (!this.enabled) return false;
    return (await this.prisma.driveConnection.count({ where: { sub } })) > 0;
  }

  async disconnect(sub: string): Promise<void> {
    const c = await this.prisma.driveConnection.findUnique({ where: { sub } });
    if (!c) return;
    await this.prisma.driveConnection.delete({ where: { sub } });
    try {
      await this.client().revokeToken(decrypt(c.refreshToken));
    } catch (e) {
      this.logger.warn(`No se pudo revocar el token en Google: ${(e as Error).message}`);
    }
  }

  // ---------- Respaldo ----------

  /** Sube el archivo al Drive de ESA cuenta (carpeta propia de la app) y devuelve el id del archivo. */
  async backup(sub: string, file: { name: string; mimeType: string; data: Buffer }): Promise<string> {
    const conn = await this.prisma.driveConnection.findUnique({ where: { sub } });
    if (!conn) throw new Error('La cuenta no tiene Drive conectado');

    const auth = this.client();
    auth.setCredentials({ refresh_token: decrypt(conn.refreshToken) });
    const api = drive({ version: 'v3', auth });

    const send = async (folderId: string) =>
      (await api.files.create({
        requestBody: { name: file.name, parents: [folderId] },
        media: { mimeType: file.mimeType, body: Readable.from(file.data) },
        fields: 'id',
      })).data.id as string;

    try {
      return await send(conn.folderId ?? (await this.ensureFolder(sub, api)));
    } catch (e) {
      if (this.isRevoked(e)) {
        // El usuario quito el acceso desde su cuenta de Google: la conexion ya no sirve.
        await this.prisma.driveConnection.delete({ where: { sub } }).catch(() => undefined);
        throw new Error('La cuenta revoco el acceso a Drive; hay que reconectar');
      }
      // Si el usuario borro la carpeta de respaldo, se crea de nuevo y se reintenta una vez.
      if (conn.folderId && this.isNotFound(e)) {
        await this.prisma.driveConnection.update({ where: { sub }, data: { folderId: null } });
        return send(await this.ensureFolder(sub, api));
      }
      throw e;
    }
  }

  private ensureFolder(sub: string, api: drive_v3.Drive): Promise<string> {
    const running = this.folderLocks.get(sub);
    if (running) return running;
    const p = (async () => {
      const id = (await api.files.create({
        requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      })).data.id as string;
      await this.prisma.driveConnection.update({ where: { sub }, data: { folderId: id } });
      return id;
    })().finally(() => this.folderLocks.delete(sub));
    this.folderLocks.set(sub, p);
    return p;
  }

  private isNotFound(e: unknown): boolean {
    const err = e as { code?: number | string; status?: number };
    return err.code === 404 || err.status === 404;
  }

  private isRevoked(e: unknown): boolean {
    const msg = String((e as Error)?.message ?? '');
    return msg.includes('invalid_grant');
  }
}
