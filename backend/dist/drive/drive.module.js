"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveModule = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const prisma_service_1 = require("../prisma/prisma.service");
const drive_controller_1 = require("./drive.controller");
const drive_service_1 = require("./drive.service");
let DriveModule = class DriveModule {
};
exports.DriveModule = DriveModule;
exports.DriveModule = DriveModule = __decorate([
    (0, common_1.Module)({
        controllers: [drive_controller_1.DriveController],
        providers: [drive_service_1.DriveService, prisma_service_1.PrismaService, auth_service_1.AuthService],
        exports: [drive_service_1.DriveService],
    })
], DriveModule);
//# sourceMappingURL=drive.module.js.map