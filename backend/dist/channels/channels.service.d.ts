import { PrismaService } from '../prisma/prisma.service';
type Stored = {
    id: number;
    content: string;
    author: string;
    channelId: number;
    createdAt: Date;
    fileName: string | null;
    fileUrl: string | null;
    mimeType: string | null;
    authorSub: string | null;
    driveStatus: string | null;
};
export declare function toPublic(m: Stored, viewerSub?: string): {
    id: number;
    content: string;
    author: string;
    channelId: number;
    createdAt: Date;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    driveStatus: string;
};
export declare class ChannelsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(name: string): Promise<{
        id: number;
        name: string;
    }>;
    findAll(): Promise<{
        id: number;
        name: string;
    }[]>;
    allIds(): Promise<number[]>;
    assertExists(channelId: number): Promise<void>;
    history(channelId: number, viewerSub?: string): Promise<{
        id: number;
        content: string;
        author: string;
        channelId: number;
        createdAt: Date;
        fileName: string;
        fileUrl: string;
        mimeType: string;
        driveStatus: string;
    }[]>;
    createMessage(channelId: number, author: string, content: string, authorSub: string, file?: {
        fileName: string;
        fileUrl: string;
        mimeType: string;
        storageKey: string;
        driveStatus: string | null;
    }): Promise<{
        createdAt: Date;
        id: number;
        content: string;
        author: string;
        fileName: string | null;
        fileUrl: string | null;
        mimeType: string | null;
        storageKey: string | null;
        authorSub: string | null;
        driveStatus: string | null;
        driveFileId: string | null;
        channelId: number;
    }>;
    setDriveResult(id: number, driveStatus: 'ok' | 'failed', driveFileId?: string): Promise<void>;
}
export {};
