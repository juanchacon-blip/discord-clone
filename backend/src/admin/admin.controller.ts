import {
  Controller, Delete, Get, Logger, Param, ParseIntPipe, Query, Req, UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.service';
import { ChannelsGateway } from '../channels/channels.gateway';
import { AdminService } from './admin.service';

type Req_ = { user: AuthUser };

// AuthGuard (clase): exige iniciar sesion. AdminGuard (cada ruta): exige ser administrador.
// La seguridad vive AQUI, en el servidor: esconder el boton en el frontend no protege nada.
@UseGuards(AuthGuard)
@Controller('admin')
export class AdminController {
  private logger = new Logger('AUDITORIA');

  constructor(private admin: AdminService, private gateway: ChannelsGateway) {}

  private audit(req: Req_, action: string) {
    this.logger.warn(`ADMIN ${req.user.name} (${req.user.sub}) ${action}`);
  }

  /** Cualquier usuario puede preguntar si es admin (para mostrar o no el boton). */
  @Get('me')
  me(@Req() req: Req_) {
    return { isAdmin: req.user.isAdmin };
  }

  @UseGuards(AdminGuard)
  @Get('channels')
  channels() {
    return this.admin.channels();
  }

  @UseGuards(AdminGuard)
  @Get('channels/:id/messages')
  messages(
    @Param('id', ParseIntPipe) id: number,
    @Query('before') before?: string,
    @Query('onlyFiles') onlyFiles?: string,
  ) {
    const cursor = Number.parseInt(before ?? '', 10);
    return this.admin.messages(id, Number.isInteger(cursor) ? cursor : undefined, onlyFiles === '1');
  }

  @UseGuards(AdminGuard)
  @Delete('channels/:id')
  async deleteChannel(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    const r = await this.admin.deleteChannel(id);
    this.audit(req, `elimino el canal #${r.name} (id ${id}) con ${r.deletedMessages} mensajes`);
    this.gateway.dropChannel(id);
    await this.gateway.refresh(); // todos recargan su lista de canales
    return r;
  }

  @UseGuards(AdminGuard)
  @Delete('messages/:id')
  async deleteMessage(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    const r = await this.admin.deleteMessage(id);
    this.audit(req, `elimino el mensaje ${id} del canal ${r.channelId}`);
    this.gateway.emitToChannel(r.channelId, 'message:deleted', { id, channelId: r.channelId });
    return r;
  }

  @UseGuards(AdminGuard)
  @Delete('messages/:id/file')
  async deleteFile(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    const r = await this.admin.deleteMessageFile(id);
    this.audit(req, `elimino el archivo del mensaje ${id} del canal ${r.channelId}`);
    if (r.messageDeleted) {
      this.gateway.emitToChannel(r.channelId, 'message:deleted', { id, channelId: r.channelId });
    } else {
      this.gateway.emitToChannel(r.channelId, 'message:updated', r.message);
    }
    return r;
  }
}
