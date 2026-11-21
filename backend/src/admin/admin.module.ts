import { Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../prisma/prisma.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ChannelsModule], // aporta ChannelsGateway y StorageService
  controllers: [AdminController],
  providers: [AdminService, PrismaService, AuthService],
})
export class AdminModule {}
