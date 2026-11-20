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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const uploads_1 = require("../channels/uploads");
let StorageService = StorageService_1 = class StorageService {
    constructor() {
        this.logger = new common_1.Logger(StorageService_1.name);
        this.url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
        this.key = process.env.SUPABASE_SERVICE_KEY ?? '';
        this.bucket = process.env.SUPABASE_BUCKET || 'chat-files';
        if (this.remote) {
            this.logger.log(`Archivos en Supabase Storage (bucket "${this.bucket}")`);
        }
        else {
            this.logger.warn('Sin SUPABASE_URL/SUPABASE_SERVICE_KEY: los archivos se guardan en disco local (se pierden al reiniciar en hostings gratis).');
        }
    }
    get remote() {
        return Boolean(this.url && this.key);
    }
    async save(storageKey, data, contentType) {
        if (!this.remote) {
            await (0, promises_1.writeFile)((0, path_1.join)(uploads_1.UPLOAD_DIR, storageKey), data);
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
        return `${this.url}/storage/v1/object/public/${this.bucket}/${storageKey}`;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StorageService);
//# sourceMappingURL=storage.service.js.map