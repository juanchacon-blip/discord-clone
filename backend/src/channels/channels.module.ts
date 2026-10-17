import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsGateway, PrismaService],
})
export class ChannelsModule {}
