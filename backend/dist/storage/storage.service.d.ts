export declare class StorageService {
    private logger;
    private url;
    private key;
    private bucket;
    constructor();
    private get remote();
    save(storageKey: string, data: Buffer, contentType: string): Promise<string>;
}
