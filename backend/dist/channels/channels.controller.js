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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChannelsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const crypto_1 = require("crypto");
const path_1 = require("path");
const auth_guard_1 = require("../auth/auth.guard");
const channels_gateway_1 = require("./channels.gateway");
const channels_service_1 = require("./channels.service");
const drive_service_1 = require("../drive/drive.service");
const storage_service_1 = require("../storage/storage.service");
const file_type_1 = require("../storage/file-type");
const uploads_1 = require("./uploads");
let ChannelsController = ChannelsController_1 = class ChannelsController {
    constructor(channels, gateway, storage, drive) {
        this.channels = channels;
        this.gateway = gateway;
        this.storage = storage;
        this.drive = drive;
        this.logger = new common_1.Logger(ChannelsController_1.name);
    }
    async create(body) {
        const channel = await this.channels.create(body.name);
        await this.gateway.refresh();
        return channel;
    }
    list() {
        return this.channels.findAll();
    }
    history(id, req) {
        return this.channels.history(id, req.user.sub);
    }
    async upload(id, file, req) {
        if (!file)
            throw new common_1.BadRequestException('Falta el archivo');
        await this.channels.assertExists(id);
        const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 100);
        const image = (0, file_type_1.sniffImage)(file.buffer);
        const mimeType = image?.mime ?? 'application/octet-stream';
        const ext = image?.ext ?? (0, path_1.extname)(fileName).replace(/[^.\w]/g, '').slice(0, 10);
        const storageKey = (0, crypto_1.randomUUID)() + ext;
        const fileUrl = await this.storage.save(storageKey, file.buffer, mimeType);
        const hasDrive = await this.drive.isConnected(req.user.sub);
        const msg = await this.channels.createMessage(id, req.user.name, '', req.user.sub, {
            fileName, fileUrl, mimeType, storageKey, driveStatus: hasDrive ? 'pending' : null,
        });
        this.gateway.broadcast((0, channels_service_1.toPublic)(msg));
        if (hasDrive)
            void this.backup(req.user.sub, msg.id, id, { name: fileName, mimeType, data: file.buffer });
        return (0, channels_service_1.toPublic)(msg, req.user.sub);
    }
    async backup(sub, messageId, channelId, file) {
        try {
            const driveFileId = await this.drive.backup(sub, file);
            await this.channels.setDriveResult(messageId, 'ok', driveFileId);
            this.gateway.notifyBackup(sub, { id: messageId, channelId, driveStatus: 'ok' });
        }
        catch (e) {
            this.logger.error(`Respaldo en Drive fallo (mensaje ${messageId}): ${e.message}`);
            await this.channels.setDriveResult(messageId, 'failed').catch(() => undefined);
            this.gateway.notifyBackup(sub, { id: messageId, channelId, driveStatus: 'failed' });
        }
    }
};
exports.ChannelsController = ChannelsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/messages'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ChannelsController.prototype, "history", null);
__decorate([
    (0, common_1.Post)(':id/files'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: uploads_1.MAX_FILE_SIZE } })),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ChannelsController.prototype, "upload", null);
exports.ChannelsController = ChannelsController = ChannelsController_1 = __decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Controller)('channels'),
    __metadata("design:paramtypes", [channels_service_1.ChannelsService,
        channels_gateway_1.ChannelsGateway,
        storage_service_1.StorageService,
        drive_service_1.DriveService])
], ChannelsController);
//# sourceMappingURL=channels.controller.js.map