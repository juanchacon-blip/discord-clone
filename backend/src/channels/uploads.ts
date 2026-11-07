import { mkdirSync } from 'fs';
import { join } from 'path';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

mkdirSync(UPLOAD_DIR, { recursive: true });
