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
import { BackupService } from './backup.service';
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
    private backup: BackupService,
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
    const msg = await this.channels.createMessage(id, req.user.name, '', req.user.sub, {
      fileName, fileUrl, mimeType, storageKey,
    });
    this.gateway.broadcast(toPublic(msg));

    // 2) Respaldo en segundo plano:
    //    - una IMAGEN se copia al Drive de TODAS las cuentas que tienen Drive conectado
    //    - cualquier otro archivo solo al Drive de quien lo subio
    const subs = image
      ? await this.drive.connectedSubs()
      : (await this.drive.isConnected(req.user.sub)) ? [req.user.sub] : [];
    void this.backup.enqueueNew(msg, subs, file.buffer).catch((e: Error) =>
      this.logger.error(`No se pudo encolar el respaldo (mensaje ${msg.id}): ${e.message}`));
    return toPublic(msg, subs.includes(req.user.sub) ? 'pending' : null);
  }

  /** Copia a MI Drive todas las imagenes de todos los canales que todavia no tengo. */
  @Post('backup-images')
  async backupImages(@Req() req: Req_) {
    return { queued: await this.backup.backfill(req.user.sub) };
  }
}
