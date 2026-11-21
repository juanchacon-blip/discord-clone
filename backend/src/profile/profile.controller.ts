import { Body, Controller, Delete, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.service';
import { ChannelsGateway } from '../channels/channels.gateway';
import { ProfileService } from './profile.service';

type Req_ = { user: AuthUser };

@UseGuards(AuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profile: ProfileService, private gateway: ChannelsGateway) {}

  @Get()
  async get(@Req() req: Req_) {
    const p = await this.profile.get(req.user.sub);
    return { name: p.custom ?? p.defaultName, custom: p.custom, defaultName: p.defaultName };
  }

  @Put()
  async set(@Body() body: { name?: string }, @Req() req: Req_) {
    const name = await this.profile.set(req.user.sub, body?.name);
    this.gateway.announceRenamed();
    return { name, custom: name, defaultName: (await this.profile.get(req.user.sub)).defaultName };
  }

  @Delete()
  async clear(@Req() req: Req_) {
    const name = await this.profile.clear(req.user.sub);
    this.gateway.announceRenamed();
    return { name, custom: null, defaultName: name };
  }
}
