export type AuthUser = {
    sub: string;
    name: string;
};
export declare class AuthService {
    private logger;
    private domain;
    private audience;
    private jwks;
    private names;
    constructor();
    verify(token: string): Promise<AuthUser>;
    private displayName;
}
