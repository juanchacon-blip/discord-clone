import { PrismaService } from '../prisma/prisma.service';
export declare class DriveService {
    private prisma;
    private logger;
    private folderLocks;
    constructor(prisma: PrismaService);
    get enabled(): boolean;
    private client;
    authUrl(sub: string): Promise<string>;
    subFromState(state: string): Promise<string>;
    connect(sub: string, code: string): Promise<void>;
    status(sub: string): Promise<{
        enabled: boolean;
        connected: boolean;
        email?: undefined;
    } | {
        enabled: boolean;
        connected: boolean;
        email: string;
    }>;
    isConnected(sub: string): Promise<boolean>;
    disconnect(sub: string): Promise<void>;
    backup(sub: string, file: {
        name: string;
        mimeType: string;
        data: Buffer;
    }): Promise<string>;
    private ensureFolder;
    private isNotFound;
    private isRevoked;
}
