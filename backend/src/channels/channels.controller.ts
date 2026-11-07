import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.service';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService } from './channels.service';
import { MAX_FILE_SIZE, UPLOAD_DIR } from './uploads';

@UseGuards(AuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private channels: ChannelsService, private gateway: ChannelsGateway) {}

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
    @Req() req: { user: AuthUser },
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');
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
