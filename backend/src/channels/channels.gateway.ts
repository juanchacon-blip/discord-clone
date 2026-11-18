import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { allowedOrigins } from '../cors';
import { CurrentUser, UsersService } from '../users/users.service';
import { ChannelsService } from './channels.service';

@WebSocketGateway({ cors: { origin: allowedOrigins() } })
export class ChannelsGateway implements OnGatewayInit {
  private logger = new Logger(ChannelsGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private channels: ChannelsService,
    private auth: AuthService,
    private users: UsersService,
  ) {}

  // Nadie se conecta al socket sin un token valido de Auth0.
  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Falta el token'));
        socket.data.user = await this.users.ensure(await this.auth.verify(token));
        next();
      } catch {
        next(new Error('Token invalido'));
      }
    });
    // El servidor decide en que canales esta cada usuario (segun su rol).
    server.on('connection', (socket) => this.sync(socket));
  }

  /** Mete al socket en los canales que su rol puede ver y lo saca de los demas. */
  private async sync(socket: Socket) {
    try {
      const user = await this.users.byId((socket.data.user as CurrentUser).id);
      socket.data.user = user;
      const allowed = new Set(await this.channels.accessibleIds(user));
      for (const id of await this.channels.allIds()) {
        if (allowed.has(id)) socket.join(`channel:${id}`);
        else socket.leave(`channel:${id}`);
      }
    } catch (e) {
      this.logger.error(`Fallo al sincronizar canales: ${(e as Error).message}`);
    }
  }

  /** Llamar cuando cambian roles, usuarios o canales: reacomoda a todos y avisa a los clientes. */
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
      const user = client.data.user as CurrentUser;
      const msg = await this.channels.createMessage(dto.channelId, user.name, dto.content);
      this.broadcast(msg);
    } catch (e) {
      this.logger.error(`Fallo al enviar mensaje: ${(e as Error).message}`);
    }
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: Socket, @MessageBody() channelId: number) {
    const room = `channel:${channelId}`;
    if (!client.rooms.has(room)) return;
    const user = client.data.user as CurrentUser;
    client.to(room).emit('typing', { channelId, name: user.name });
  }

  broadcast(msg: { channelId: number }) {
    this.server.to(`channel:${msg.channelId}`).emit('message', msg);
  }
}
