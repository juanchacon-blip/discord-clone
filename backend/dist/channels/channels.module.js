"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const channels_controller_1 = require("./channels.controller");
const channels_gateway_1 = require("./channels.gateway");
const channels_service_1 = require("./channels.service");
const prisma_service_1 = require("../prisma/prisma.service");
const drive_module_1 = require("../drive/drive.module");
const storage_service_1 = require("../storage/storage.service");
let ChannelsModule = class ChannelsModule {
};
exports.ChannelsModule = ChannelsModule;
exports.ChannelsModule = ChannelsModule = __decorate([
    (0, common_1.Module)({
        imports: [drive_module_1.DriveModule],
        controllers: [channels_controller_1.ChannelsController],
        providers: [channels_service_1.ChannelsService, channels_gateway_1.ChannelsGateway, prisma_service_1.PrismaService, auth_service_1.AuthService, storage_service_1.StorageService],
    })
], ChannelsModule);
//# sourceMappingURL=channels.module.js.map