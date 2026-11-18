import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Va despues de AuthGuard: solo deja pasar al rol administrador. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.isAdmin) throw new ForbiddenException('Solo el administrador puede hacer esto');
    return true;
  }
}
