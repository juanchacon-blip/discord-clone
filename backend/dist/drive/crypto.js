"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.stateSecret = stateSecret;
const crypto_1 = require("crypto");
function key() {
    const secret = process.env.TOKEN_ENCRYPTION_KEY ?? '';
    if (secret.length < 16)
        throw new Error('Falta TOKEN_ENCRYPTION_KEY (minimo 16 caracteres) en backend/.env');
    return (0, crypto_1.createHash)('sha256').update(secret).digest();
}
function encrypt(plain) {
    const iv = (0, crypto_1.randomBytes)(12);
    const c = (0, crypto_1.createCipheriv)('aes-256-gcm', key(), iv);
    const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}
function decrypt(payload) {
    const raw = Buffer.from(payload, 'base64');
    const d = (0, crypto_1.createDecipheriv)('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}
function stateSecret() {
    return new Uint8Array((0, crypto_1.createHash)('sha256').update('oauth-state:' + (process.env.TOKEN_ENCRYPTION_KEY ?? '')).digest());
}
//# sourceMappingURL=crypto.js.map