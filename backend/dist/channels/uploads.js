"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILE_SIZE = exports.UPLOAD_DIR = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
exports.UPLOAD_DIR = (0, path_1.join)(process.cwd(), 'uploads');
exports.MAX_FILE_SIZE = 10 * 1024 * 1024;
(0, fs_1.mkdirSync)(exports.UPLOAD_DIR, { recursive: true });
//# sourceMappingURL=uploads.js.map