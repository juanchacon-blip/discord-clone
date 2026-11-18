import { Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AdminController } from './admin.controller';
import { ChannelsController } from './channels.controller';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Module({
  controllers: [ChannelsController, AdminController],
  providers: [ChannelsService, ChannelsGateway, PrismaService, AuthService, UsersService],
})
export class ChannelsModule {}
