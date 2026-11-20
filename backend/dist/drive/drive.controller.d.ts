import { Response } from 'express';
import { AuthUser } from '../auth/auth.service';
import { DriveService } from './drive.service';
type Req_ = {
    user: AuthUser;
};
export declare class DriveController {
    private drive;
    constructor(drive: DriveService);
    status(req: Req_): Promise<{
        enabled: boolean;
        connected: boolean;
        email?: undefined;
    } | {
        enabled: boolean;
        connected: boolean;
        email: string;
    }>;
    authUrl(req: Req_): Promise<{
        url: string;
    }>;
    callback(code: string, state: string, error: string, res: Response): Promise<void>;
    disconnect(req: Req_): Promise<void>;
}
export {};
