import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService, AuthUser } from '../auth/auth.service';
import { allowedOrigins } from '../cors';
import { ChannelsService } from './channels.service';

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
  }

  @SubscribeMessage('join')
  join(@ConnectedSocket() client: Socket, @MessageBody() channelId: number) {
    client.join(`channel:${channelId}`);
  }

  @SubscribeMessage('message')
  async message(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { channelId: number; content: string },
  ) {
    try {
      // El autor sale del token, NUNCA de lo que mande el navegador.
      const user = client.data.user as AuthUser;
      const msg = await this.channels.createMessage(dto.channelId, user.name, dto.content);
      this.server.to(`channel:${dto.channelId}`).emit('message', msg);
    } catch (e) {
      this.logger.error(`Fallo al enviar mensaje: ${e.message}`);
    }
  }
}
