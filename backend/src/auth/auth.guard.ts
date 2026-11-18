import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

/** Protege las rutas REST: exige "Authorization: Bearer <token de Auth0>". */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Falta el token');
    req.user = await this.users.ensure(await this.auth.verify(token));
    return true;
  }
}
