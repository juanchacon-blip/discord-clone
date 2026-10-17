import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChannelsService } from './channels.service';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class ChannelsGateway {
  private logger = new Logger(ChannelsGateway.name);
  @WebSocketServer() server: Server;

  constructor(private channels: ChannelsService) {}

  @SubscribeMessage('join')
  join(@ConnectedSocket() client: Socket, @MessageBody() channelId: number) {
    client.join(`channel:${channelId}`);
  }

  @SubscribeMessage('message')
  async message(@MessageBody() dto: { channelId: number; author: string; content: string }) {
    try {
      const msg = await this.channels.createMessage(dto.channelId, dto.author, dto.content);
      this.server.to(`channel:${dto.channelId}`).emit('message', msg);
    } catch (e) {
      this.logger.error(`Fallo al enviar mensaje: ${e.message}`);
    }
  }
}
