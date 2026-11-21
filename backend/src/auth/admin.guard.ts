import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Se usa DESPUES de AuthGuard: solo deja pasar a las cuentas administradoras. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.isAdmin) throw new ForbiddenException('Solo para administradores');
    return true;
  }
}
