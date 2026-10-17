import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  create(name: string) {
    return this.prisma.channel.create({ data: { name } });
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
    return this.prisma.message.create({ data: { channelId, author, content } });
  }
}
