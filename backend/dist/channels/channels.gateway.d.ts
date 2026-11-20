import { OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { ChannelsService } from './channels.service';
export declare class ChannelsGateway implements OnGatewayInit {
    private channels;
    private auth;
    private logger;
    server: Server;
    constructor(channels: ChannelsService, auth: AuthService);
    afterInit(server: Server): void;
    private sync;
    refresh(): Promise<void>;
    message(client: Socket, dto: {
        channelId: number;
        content: string;
    }): Promise<void>;
    typing(client: Socket, channelId: number): void;
    broadcast(msg: {
        channelId: number;
    }): void;
    notifyBackup(sub: string, info: {
        id: number;
        channelId: number;
        driveStatus: 'ok' | 'failed';
    }): void;
}
