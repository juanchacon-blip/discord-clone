import { Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [ChannelsModule], // aporta ChannelsGateway
  controllers: [ProfileController],
  providers: [ProfileService, PrismaService, AuthService],
})
export class ProfileModule {}
