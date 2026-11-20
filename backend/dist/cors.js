"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowedOrigins = allowedOrigins;
require("dotenv/config");
function allowedOrigins() {
    const list = (process.env.FRONTEND_URL ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return list.length ? list : undefined;
}
//# sourceMappingURL=cors.js.map