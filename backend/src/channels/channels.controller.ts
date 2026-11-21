import {
  BadRequestException, Body, Controller, Get, HttpCode, Logger, Param, ParseIntPipe, Post, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { AuthUser } from '../auth/auth.service';
import { AuthGuard } from '../auth/auth.guard';
import { ChannelsGateway } from './channels.gateway';
import { ChannelsService, toPublic } from './channels.service';
import { DriveService } from '../drive/drive.service';
import { StorageService } from '../storage/storage.service';
import { sniffImage } from '../storage/file-type';
import { MAX_FILE_SIZE } from './uploads';

type Req_ = { user: AuthUser };

@UseGuards(AuthGuard)
@Controller('channels')
export class ChannelsController {
  private logger = new Logger(ChannelsController.name);

  constructor(
    private channels: ChannelsService,
    private gateway: ChannelsGateway,
    private storage: StorageService,
    private drive: DriveService,
  ) {}

  @Post()
  async create(@Body() body: { name: string }) {
    const channel = await this.channels.create(body.name);
    await this.gateway.refresh();
    return channel;
  }

  @Get()
  list(@Req() req: Req_) {
    return this.channels.findAll(req.user.sub);
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    await this.channels.markRead(req.user.sub, id);
  }

  @Get(':id/messages')
  history(@Param('id', ParseIntPipe) id: number, @Req() req: Req_) {
    return this.channels.history(id, req.user.sub);
  }

  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } })) // en memoria (max 10 MB)
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Req_,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');
    await this.channels.assertExists(id);

    // multer entrega el nombre original en latin1; lo pasamos a utf8 (tildes, ñ).
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 100);
    // Tipo real segun el contenido. Si no es una imagen conocida, se guarda como descarga.
    const image = sniffImage(file.buffer);
    const mimeType = image?.mime ?? 'application/octet-stream';
    const ext = image?.ext ?? extname(fileName).replace(/[^.\w]/g, '').slice(0, 10);
    const storageKey = randomUUID() + ext;

    // 1) Copia del proyecto (de aqui sale lo que ve todo el chat)
    const fileUrl = await this.storage.save(storageKey, file.buffer, mimeType);

    // 2) Si la cuenta tiene Drive conectado, el respaldo se hace en segundo plano
    const hasDrive = await this.drive.isConnected(req.user.sub);
    const msg = await this.channels.createMessage(id, req.user.name, '', req.user.sub, {
      fileName, fileUrl, mimeType, storageKey, driveStatus: hasDrive ? 'pending' : null,
    });
    this.gateway.broadcast(toPublic(msg));
    if (hasDrive) void this.backup(req.user.sub, msg.id, id, { name: fileName, mimeType, data: file.buffer });
    return toPublic(msg, req.user.sub);
  }

  private async backup(sub: string, messageId: number, channelId: number, file: { name: string; mimeType: string; data: Buffer }) {
    try {
      const driveFileId = await this.drive.backup(sub, file);
      await this.channels.setDriveResult(messageId, 'ok', driveFileId);
      this.gateway.notifyBackup(sub, { id: messageId, channelId, driveStatus: 'ok' });
    } catch (e) {
      this.logger.error(`Respaldo en Drive fallo (mensaje ${messageId}): ${(e as Error).message}`);
      await this.channels.setDriveResult(messageId, 'failed').catch(() => undefined);
      this.gateway.notifyBackup(sub, { id: messageId, channelId, driveStatus: 'failed' });
    }
  }
}
