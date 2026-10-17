import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ChannelsService } from './channels.service';

@Controller('channels')
export class ChannelsController {
  constructor(private channels: ChannelsService) {}

  @Post()
  create(@Body() body: { name: string }) {
    return this.channels.create(body.name);
  }

  @Get()
  list() {
    return this.channels.findAll();
  }

  @Get(':id/messages')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.channels.history(id);
  }
}
