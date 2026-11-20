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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jose_1 = require("jose");
let AuthService = AuthService_1 = class AuthService {
    constructor() {
        this.logger = new common_1.Logger(AuthService_1.name);
        this.names = new Map();
        this.domain = process.env.AUTH0_DOMAIN ?? '';
        this.audience = process.env.AUTH0_AUDIENCE ?? '';
        if (!this.domain || !this.audience) {
            throw new Error('Faltan AUTH0_DOMAIN y/o AUTH0_AUDIENCE en backend/.env');
        }
        this.jwks = (0, jose_1.createRemoteJWKSet)(new URL(`https://${this.domain}/.well-known/jwks.json`));
    }
    async verify(token) {
        try {
            const { payload } = await (0, jose_1.jwtVerify)(token, this.jwks, {
                issuer: `https://${this.domain}/`,
                audience: this.audience,
            });
            const sub = String(payload.sub);
            return { sub, name: await this.displayName(sub, token) };
        }
        catch (e) {
            this.logger.warn(`Token rechazado: ${e.message}`);
            throw new common_1.UnauthorizedException('Token invalido');
        }
    }
    async displayName(sub, token) {
        const cached = this.names.get(sub);
        if (cached)
            return cached;
        let name = 'usuario';
        try {
            const res = await fetch(`https://${this.domain}/userinfo`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const info = (await res.json());
                name = (info.nickname || info.name || name).slice(0, 32);
            }
        }
        catch (e) {
            this.logger.warn(`No se pudo leer /userinfo: ${e.message}`);
        }
        this.names.set(sub, name);
        return name;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AuthService);
//# sourceMappingURL=auth.service.js.map