import { Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ChannelsController } from './channels.controller';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsGateway, PrismaService, AuthService],
})
export class ChannelsModule {}
