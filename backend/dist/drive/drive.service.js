"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DriveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveService = void 0;
const common_1 = require("@nestjs/common");
const drive_1 = require("@googleapis/drive");
const google_auth_library_1 = require("google-auth-library");
const jose_1 = require("jose");
const stream_1 = require("stream");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("./crypto");
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];
const FOLDER_NAME = 'Discord Clone - Respaldo';
let DriveService = DriveService_1 = class DriveService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(DriveService_1.name);
        this.folderLocks = new Map();
        if (!this.enabled)
            this.logger.warn('Google Drive desactivado: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI / TOKEN_ENCRYPTION_KEY.');
    }
    get enabled() {
        return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
            process.env.GOOGLE_REDIRECT_URI && process.env.TOKEN_ENCRYPTION_KEY);
    }
    client() {
        if (!this.enabled)
            throw new common_1.ServiceUnavailableException('Google Drive no esta configurado en el servidor');
        return new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    }
    async authUrl(sub) {
        const state = await new jose_1.SignJWT({ sub })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('10m')
            .sign((0, crypto_1.stateSecret)());
        return this.client().generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES,
            state,
        });
    }
    async subFromState(state) {
        try {
            const { payload } = await (0, jose_1.jwtVerify)(state, (0, crypto_1.stateSecret)());
            return String(payload.sub);
        }
        catch {
            throw new common_1.BadRequestException('state invalido o vencido');
        }
    }
    async connect(sub, code) {
        const client = this.client();
        const { tokens } = await client.getToken(code);
        if (!tokens.scope?.includes('drive.file'))
            throw new common_1.BadRequestException('No se concedio el permiso de Drive');
        if (!tokens.refresh_token)
            throw new common_1.BadRequestException('Google no entrego refresh token');
        let email;
        if (tokens.id_token) {
            const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
            email = ticket.getPayload()?.email;
        }
        await this.prisma.driveConnection.upsert({
            where: { sub },
            create: { sub, email, refreshToken: (0, crypto_1.encrypt)(tokens.refresh_token) },
            update: { email, refreshToken: (0, crypto_1.encrypt)(tokens.refresh_token), folderId: null },
        });
    }
    async status(sub) {
        if (!this.enabled)
            return { enabled: false, connected: false };
        const c = await this.prisma.driveConnection.findUnique({ where: { sub } });
        return { enabled: true, connected: Boolean(c), email: c?.email ?? null };
    }
    async isConnected(sub) {
        if (!this.enabled)
            return false;
        return (await this.prisma.driveConnection.count({ where: { sub } })) > 0;
    }
    async disconnect(sub) {
        const c = await this.prisma.driveConnection.findUnique({ where: { sub } });
        if (!c)
            return;
        await this.prisma.driveConnection.delete({ where: { sub } });
        try {
            await this.client().revokeToken((0, crypto_1.decrypt)(c.refreshToken));
        }
        catch (e) {
            this.logger.warn(`No se pudo revocar el token en Google: ${e.message}`);
        }
    }
    async backup(sub, file) {
        const conn = await this.prisma.driveConnection.findUnique({ where: { sub } });
        if (!conn)
            throw new Error('La cuenta no tiene Drive conectado');
        const auth = this.client();
        auth.setCredentials({ refresh_token: (0, crypto_1.decrypt)(conn.refreshToken) });
        const api = (0, drive_1.drive)({ version: 'v3', auth });
        const send = async (folderId) => (await api.files.create({
            requestBody: { name: file.name, parents: [folderId] },
            media: { mimeType: file.mimeType, body: stream_1.Readable.from(file.data) },
            fields: 'id',
        })).data.id;
        try {
            return await send(conn.folderId ?? (await this.ensureFolder(sub, api)));
        }
        catch (e) {
            if (this.isRevoked(e)) {
                await this.prisma.driveConnection.delete({ where: { sub } }).catch(() => undefined);
                throw new Error('La cuenta revoco el acceso a Drive; hay que reconectar');
            }
            if (conn.folderId && this.isNotFound(e)) {
                await this.prisma.driveConnection.update({ where: { sub }, data: { folderId: null } });
                return send(await this.ensureFolder(sub, api));
            }
            throw e;
        }
    }
    ensureFolder(sub, api) {
        const running = this.folderLocks.get(sub);
        if (running)
            return running;
        const p = (async () => {
            const id = (await api.files.create({
                requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
                fields: 'id',
            })).data.id;
            await this.prisma.driveConnection.update({ where: { sub }, data: { folderId: id } });
            return id;
        })().finally(() => this.folderLocks.delete(sub));
        this.folderLocks.set(sub, p);
        return p;
    }
    isNotFound(e) {
        const err = e;
        return err.code === 404 || err.status === 404;
    }
    isRevoked(e) {
        const msg = String(e?.message ?? '');
        return msg.includes('invalid_grant');
    }
};
exports.DriveService = DriveService;
exports.DriveService = DriveService = DriveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DriveService);
//# sourceMappingURL=drive.service.js.map