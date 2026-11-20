import { Controller, Delete, Get, HttpCode, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.service';
import { DriveService } from './drive.service';

type Req_ = { user: AuthUser };

// A donde volver despues de Google: el primer FRONTEND_URL, o el mismo dominio si no hay.
function back(result: 'ok' | 'error'): string {
  const base = (process.env.FRONTEND_URL ?? '').split(',')[0].trim().replace(/\/+$/, '');
  return `${base || ''}/?drive=${result}`;
}

@Controller('drive')
export class DriveController {
  constructor(private drive: DriveService) {}

  @UseGuards(AuthGuard)
  @Get('status')
  status(@Req() req: Req_) {
    return this.drive.status(req.user.sub);
  }

  // El navegador no puede mandar el token en una redireccion, asi que el frontend
  // pide la URL por fetch (con token) y despues navega a ella.
  @UseGuards(AuthGuard)
  @Get('auth-url')
  async authUrl(@Req() req: Req_) {
    return { url: await this.drive.authUrl(req.user.sub) };
  }

  // Google vuelve aqui. No lleva token de Auth0: se identifica por el "state" firmado.
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    if (error || !code || !state) return res.redirect(back('error'));
    try {
      const sub = await this.drive.subFromState(state);
      await this.drive.connect(sub, code);
      return res.redirect(back('ok'));
    } catch {
      return res.redirect(back('error'));
    }
  }

  @UseGuards(AuthGuard)
  @Delete()
  @HttpCode(204)
  async disconnect(@Req() req: Req_) {
    await this.drive.disconnect(req.user.sub);
  }
}
