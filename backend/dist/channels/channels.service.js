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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelsService = void 0;
exports.toPublic = toPublic;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const MAX_CHANNEL_NAME = 50;
const MAX_AUTHOR = 32;
const MAX_CONTENT = 2000;
function toPublic(m, viewerSub) {
    return {
        id: m.id, content: m.content, author: m.author, channelId: m.channelId, createdAt: m.createdAt,
        fileName: m.fileName, fileUrl: m.fileUrl, mimeType: m.mimeType,
        driveStatus: viewerSub && m.authorSub === viewerSub ? m.driveStatus : null,
    };
}
let ChannelsService = class ChannelsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(name) {
        const clean = String(name ?? '').trim().slice(0, MAX_CHANNEL_NAME);
        if (!clean)
            throw new common_1.BadRequestException('Nombre de canal invalido');
        const c = await this.prisma.channel.create({ data: { name: clean } });
        return { id: c.id, name: c.name };
    }
    async findAll() {
        const list = await this.prisma.channel.findMany({ orderBy: { id: 'asc' } });
        return list.map(c => ({ id: c.id, name: c.name }));
    }
    async allIds() {
        return (await this.prisma.channel.findMany({ select: { id: true } })).map(c => c.id);
    }
    async assertExists(channelId) {
        const n = await this.prisma.channel.count({ where: { id: channelId } });
        if (!n)
            throw new common_1.NotFoundException('El canal no existe');
    }
    async history(channelId, viewerSub) {
        await this.assertExists(channelId);
        const msgs = await this.prisma.message.findMany({
            where: { channelId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return msgs.reverse().map(m => toPublic(m, viewerSub));
    }
    async createMessage(channelId, author, content, authorSub, file) {
        const cleanAuthor = String(author ?? '').trim().slice(0, MAX_AUTHOR);
        const cleanContent = String(content ?? '').trim().slice(0, MAX_CONTENT);
        if (!Number.isInteger(channelId) || !cleanAuthor || (!cleanContent && !file)) {
            throw new common_1.BadRequestException('Mensaje invalido');
        }
        return this.prisma.message.create({
            data: { channelId, author: cleanAuthor, authorSub, content: cleanContent, ...file },
        });
    }
    async setDriveResult(id, driveStatus, driveFileId) {
        await this.prisma.message.update({ where: { id }, data: { driveStatus, driveFileId } });
    }
};
exports.ChannelsService = ChannelsService;
exports.ChannelsService = ChannelsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChannelsService);
//# sourceMappingURL=channels.service.js.map