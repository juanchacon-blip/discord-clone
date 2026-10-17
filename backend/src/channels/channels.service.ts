import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Limites basicos: ahora que la app es publica, cualquiera puede mandar datos.
const MAX_CHANNEL_NAME = 50;
const MAX_AUTHOR = 32;
const MAX_CONTENT = 2000;

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  create(name: string) {
    const clean = String(name ?? '').trim().slice(0, MAX_CHANNEL_NAME);
    if (!clean) throw new BadRequestException('Nombre de canal invalido');
    return this.prisma.channel.create({ data: { name: clean } });
  }

  findAll() {
    return this.prisma.channel.findMany();
  }

  async history(channelId: number) {
    const msgs = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return msgs.reverse();
  }

  createMessage(channelId: number, author: string, content: string) {
    const cleanAuthor = String(author ?? '').trim().slice(0, MAX_AUTHOR);
    const cleanContent = String(content ?? '').trim().slice(0, MAX_CONTENT);
    if (!Number.isInteger(channelId) || !cleanAuthor || !cleanContent) {
      throw new BadRequestException('Mensaje invalido');
    }
    return this.prisma.message.create({
      data: { channelId, author: cleanAuthor, content: cleanContent },
    });
  }
}
