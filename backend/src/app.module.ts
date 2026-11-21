import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChannelsModule } from './channels/channels.module';
import { AdminModule } from './admin/admin.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [ChannelsModule, AdminModule, ProfileModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
