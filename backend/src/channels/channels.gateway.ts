import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService, AuthUser } from '../auth/auth.service';
import { allowedOrigins } from '../cors';
import { ChannelsService, toPublic } from './channels.service';

@WebSocketGateway({ cors: { origin: allowedOrigins() } })
export class ChannelsGateway implements OnGatewayInit {
  private logger = new Logger(ChannelsGateway.name);
  @WebSocketServer() server: Server;

  constructor(private channels: ChannelsService, private auth: AuthService) {}

  // Nadie se conecta al socket sin un token valido de Auth0.
  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Falta el token'));
        socket.data.user = await this.auth.verify(token);
        next();
      } catch {
        next(new Error('Token invalido'));
      }
    });
    // Cada usuario autenticado entra a todos los canales.
    server.on('connection', (socket) => {
      // Sala privada de la cuenta: sirve para avisarle solo a ella como va su respaldo en Drive.
      socket.join(`user:${(socket.data.user as AuthUser).sub}`);
      void this.sync(socket);
    });
  }

  /** Mete al socket en todos los canales existentes. */
  private async sync(socket: Socket) {
    try {
      for (const id of await this.channels.allIds()) socket.join(`channel:${id}`);
    } catch (e) {
      this.logger.error(`Fallo al sincronizar canales: ${(e as Error).message}`);
    }
  }

  /** Llamar cuando se crea un canal: mete a todos los conectados y avisa a los clientes. */
  async refresh() {
    await Promise.all([...this.server.sockets.sockets.values()].map(s => this.sync(s)));
    this.server.emit('channels:changed');
  }

  @SubscribeMessage('message')
  async message(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { channelId: number; content: string },
  ) {
    try {
      if (!client.rooms.has(`channel:${dto.channelId}`)) return;
      // El autor sale del token, NUNCA de lo que mande el navegador.
      const user = client.data.user as AuthUser;
      const msg = await this.channels.createMessage(dto.channelId, user.name, dto.content, user.sub);
      this.broadcast(toPublic(msg));
    } catch (e) {
      this.logger.error(`Fallo al enviar mensaje: ${(e as Error).message}`);
    }
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: Socket, @MessageBody() channelId: number) {
    const room = `channel:${channelId}`;
    if (!client.rooms.has(room)) return;
    const user = client.data.user as AuthUser;
    client.to(room).emit('typing', { channelId, name: user.name });
  }

  broadcast(msg: { channelId: number }) {
    this.server.to(`channel:${msg.channelId}`).emit('message', msg);
  }

  /** Solo la cuenta que subio el archivo se entera de si el respaldo en Drive salio bien. */
  notifyBackup(sub: string, info: { id: number; channelId: number; driveStatus: 'ok' | 'failed' }) {
    this.server.to(`user:${sub}`).emit('message:backup', info);
  }
}
