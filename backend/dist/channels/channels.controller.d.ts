import { AuthUser } from '../auth/auth.service';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { DriveService } from '../drive/drive.service';
import { StorageService } from '../storage/storage.service';
type Req_ = {
    user: AuthUser;
};
export declare class ChannelsController {
    private channels;
    private gateway;
    private storage;
    private drive;
    private logger;
    constructor(channels: ChannelsService, gateway: ChannelsGateway, storage: StorageService, drive: DriveService);
    create(body: {
        name: string;
    }): Promise<{
        id: number;
        name: string;
    }>;
    list(): Promise<{
        id: number;
        name: string;
    }[]>;
    history(id: number, req: Req_): Promise<{
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
    upload(id: number, file: Express.Multer.File, req: Req_): Promise<{
        id: number;
        content: string;
        author: string;
        channelId: number;
        createdAt: Date;
        fileName: string;
        fileUrl: string;
        mimeType: string;
        driveStatus: string;
    }>;
    private backup;
}
export {};
