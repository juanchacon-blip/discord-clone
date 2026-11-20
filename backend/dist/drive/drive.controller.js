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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const drive_service_1 = require("./drive.service");
function back(result) {
    const base = (process.env.FRONTEND_URL ?? '').split(',')[0].trim().replace(/\/+$/, '');
    return `${base || ''}/?drive=${result}`;
}
let DriveController = class DriveController {
    constructor(drive) {
        this.drive = drive;
    }
    status(req) {
        return this.drive.status(req.user.sub);
    }
    async authUrl(req) {
        return { url: await this.drive.authUrl(req.user.sub) };
    }
    async callback(code, state, error, res) {
        if (error || !code || !state)
            return res.redirect(back('error'));
        try {
            const sub = await this.drive.subFromState(state);
            await this.drive.connect(sub, code);
            return res.redirect(back('ok'));
        }
        catch {
            return res.redirect(back('error'));
        }
    }
    async disconnect(req) {
        await this.drive.disconnect(req.user.sub);
    }
};
exports.DriveController = DriveController;
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DriveController.prototype, "status", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('auth-url'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DriveController.prototype, "authUrl", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], DriveController.prototype, "callback", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Delete)(),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DriveController.prototype, "disconnect", null);
exports.DriveController = DriveController = __decorate([
    (0, common_1.Controller)('drive'),
    __metadata("design:paramtypes", [drive_service_1.DriveService])
], DriveController);
//# sourceMappingURL=drive.controller.js.map