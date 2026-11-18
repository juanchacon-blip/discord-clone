import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../users/users.service';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { MAX_FILE_SIZE, UPLOAD_DIR } from './uploads';

type Req_ = { user: CurrentUser };

@UseGuards(AuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private channels: ChannelsService, private gateway: ChannelsGateway) {}

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() body: { name: string; roleIds?: number[] }) {
    const channel = await this.channels.create(body.name, body.roleIds);
    await this.gateway.refresh();
    return channel;
  }

  @Get()
  list(@Req() req: Req_) {
    return this.channels.findAll(req.user);
  }

  @Patch(':id/roles')
  @UseGuards(AdminGuard)
  async setRoles(@Param('id', ParseIntPipe) id: number, @Body() body: { roleIds: number[] }) {
    const channel = await this.channels.setRoles(id, body.roleIds);
    await this.gateway.refresh();
    return channel;
  }

  @Get(':id/messages')
  history(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    return this.channels.history(req.user, id);
  }

  @Post(':id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) =>
          cb(null, randomUUID() + extname(file.originalname).replace(/[^.\w]/g, '').slice(0, 10)),
      }),
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Req_,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');
    try {
      await this.channels.assertAccess(req.user, id);
    } catch (e) {
      await unlink(file.path).catch(() => undefined);
      throw e;
    }
    // multer entrega el nombre original en latin1; lo pasamos a utf8 (tildes, ñ).
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 100);
    const msg = await this.channels.createMessage(id, req.user.name, '', {
      fileName,
      fileUrl: `/uploads/${file.filename}`,
    });
    this.gateway.broadcast(msg);
    return msg;
  }
}
