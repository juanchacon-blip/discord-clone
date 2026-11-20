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
var ChannelsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const auth_service_1 = require("../auth/auth.service");
const cors_1 = require("../cors");
const channels_service_1 = require("./channels.service");
let ChannelsGateway = ChannelsGateway_1 = class ChannelsGateway {
    constructor(channels, auth) {
        this.channels = channels;
        this.auth = auth;
        this.logger = new common_1.Logger(ChannelsGateway_1.name);
    }
    afterInit(server) {
        server.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token;
                if (!token)
                    return next(new Error('Falta el token'));
                socket.data.user = await this.auth.verify(token);
                next();
            }
            catch {
                next(new Error('Token invalido'));
            }
        });
        server.on('connection', (socket) => {
            socket.join(`user:${socket.data.user.sub}`);
            void this.sync(socket);
        });
    }
    async sync(socket) {
        try {
            for (const id of await this.channels.allIds())
                socket.join(`channel:${id}`);
        }
        catch (e) {
            this.logger.error(`Fallo al sincronizar canales: ${e.message}`);
        }
    }
    async refresh() {
        await Promise.all([...this.server.sockets.sockets.values()].map(s => this.sync(s)));
        this.server.emit('channels:changed');
    }
    async message(client, dto) {
        try {
            if (!client.rooms.has(`channel:${dto.channelId}`))
                return;
            const user = client.data.user;
            const msg = await this.channels.createMessage(dto.channelId, user.name, dto.content, user.sub);
            this.broadcast((0, channels_service_1.toPublic)(msg));
        }
        catch (e) {
            this.logger.error(`Fallo al enviar mensaje: ${e.message}`);
        }
    }
    typing(client, channelId) {
        const room = `channel:${channelId}`;
        if (!client.rooms.has(room))
            return;
        const user = client.data.user;
        client.to(room).emit('typing', { channelId, name: user.name });
    }
    broadcast(msg) {
        this.server.to(`channel:${msg.channelId}`).emit('message', msg);
    }
    notifyBackup(sub, info) {
        this.server.to(`user:${sub}`).emit('message:backup', info);
    }
};
exports.ChannelsGateway = ChannelsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChannelsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChannelsGateway.prototype, "message", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Number]),
    __metadata("design:returntype", void 0)
], ChannelsGateway.prototype, "typing", null);
exports.ChannelsGateway = ChannelsGateway = ChannelsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: (0, cors_1.allowedOrigins)() } }),
    __metadata("design:paramtypes", [channels_service_1.ChannelsService, auth_service_1.AuthService])
], ChannelsGateway);
//# sourceMappingURL=channels.gateway.js.map