import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChannelsModule } from './channels/channels.module';

@Module({
  imports: [ChannelsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
