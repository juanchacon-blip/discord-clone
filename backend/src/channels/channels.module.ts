import { Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ChannelsController } from './channels.controller';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../prisma/prisma.service';
import { DriveModule } from '../drive/drive.module';
import { StorageService } from '../storage/storage.service';
import { BackupService } from './backup.service';

@Module({
  imports: [DriveModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsGateway, PrismaService, AuthService, StorageService, BackupService],
  exports: [ChannelsGateway, StorageService],
})
export class ChannelsModule {}
