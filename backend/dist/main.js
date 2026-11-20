"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const fs_1 = require("fs");
const path_1 = require("path");
const app_module_1 = require("./app.module");
const cors_1 = require("./cors");
const uploads_1 = require("./channels/uploads");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({ origin: (0, cors_1.allowedOrigins)() });
    app.useStaticAssets(uploads_1.UPLOAD_DIR, {
        prefix: '/uploads',
        setHeaders: (res) => {
            res.setHeader('Content-Disposition', 'attachment');
            res.setHeader('X-Content-Type-Options', 'nosniff');
        },
    });
    const frontendDist = (0, path_1.join)(__dirname, '..', '..', 'frontend', 'dist');
    if ((0, fs_1.existsSync)(frontendDist)) {
        app.useStaticAssets(frontendDist);
    }
    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map