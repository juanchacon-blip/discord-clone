import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChannelsModule } from './channels/channels.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [ChannelsModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
