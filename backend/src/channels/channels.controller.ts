import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ChannelsService } from './channels.service';

@UseGuards(AuthGuard)
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
