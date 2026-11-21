import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DriveService } from '../drive/drive.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileMissingError, StorageService } from '../storage/storage.service';
import { ChannelsGateway } from './channels.gateway';

type Image = { id: number; channelId: number; author: string; fileName: string | null; fileUrl: string | null; mimeType: string | null; createdAt: Date };
type Task = { sub: string; image: Image; channelName: string; data?: Buffer };

const CONCURRENCY = 2; // copias a Drive al mismo tiempo (para no saturar a Google ni la memoria del servidor)

/**
 * Copia las IMAGENES de todos los canales al Drive de cada cuenta conectada.
 *  - Imagen nueva: se copia a todas las cuentas conectadas.
 *  - Cuenta que se conecta (o reintenta): se copian todas las que le falten, tambien las anteriores.
 * Las copias salen de una cola en memoria; el estado de cada una queda en la tabla DriveBackup.
 */
@Injectable()
export class BackupService {
  private logger = new Logger(BackupService.name);
  private queue: Task[] = [];
  private queued = new Set<string>(); // evita encolar dos veces la misma imagen para la misma cuenta
  private running = 0;

  constructor(
    private prisma: PrismaService,
    private drive: DriveService,
    private storage: StorageService,
    private gateway: ChannelsGateway,
  ) {}

  /** Imagen recien subida: copiarla al Drive de estas cuentas. Devuelve a quienes se les encolo. */
  async enqueueNew(image: Image, subs: string[], data: Buffer): Promise<void> {
    if (!subs.length) return;
    const channel = await this.prisma.channel.findUnique({ where: { id: image.channelId }, select: { name: true } });
    await this.markPending(subs, [image.id]);
    for (const sub of subs) this.push({ sub, image, channelName: channel?.name ?? '?', data });
  }

  /** Copia al Drive de esta cuenta todas las imagenes que todavia no tiene. Devuelve cuantas encolo. */
  async backfill(sub: string): Promise<number> {
    if (!(await this.drive.isConnected(sub))) throw new BadRequestException('Primero conecta tu Google Drive');
    const done = await this.prisma.driveBackup.findMany({
      where: { sub, status: { in: ['ok', 'missing'] } }, // 'failed' y 'pending' se reintentan
      select: { messageId: true },
    });
    const skip = new Set<number>(done.map((d) => d.messageId));
    const images: Image[] = await this.prisma.message.findMany({
      where: { fileUrl: { not: null }, mimeType: { startsWith: 'image/' } },
      orderBy: { id: 'asc' },
      select: { id: true, channelId: true, author: true, fileName: true, fileUrl: true, mimeType: true, createdAt: true },
    });
    const missing = images.filter((m) => !skip.has(m.id));
    if (!missing.length) return 0;

    const channels = await this.prisma.channel.findMany({ select: { id: true, name: true } });
    const names = new Map<number, string>(channels.map((c) => [c.id, c.name]));
    await this.markPending([sub], missing.map((m) => m.id));
    for (const image of missing) this.push({ sub, image, channelName: names.get(image.channelId) ?? '?' });
    return missing.length;
  }

  private async markPending(subs: string[], messageIds: number[]) {
    const data = subs.flatMap((sub) => messageIds.map((messageId) => ({ sub, messageId, status: 'pending' })));
    await this.prisma.driveBackup.createMany({ data, skipDuplicates: true });
    await this.prisma.driveBackup.updateMany({
      where: { sub: { in: subs }, messageId: { in: messageIds }, status: { not: 'ok' } },
      data: { status: 'pending' },
    });
  }

  private push(task: Task) {
    const key = `${task.sub}:${task.image.id}`;
    if (this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push(task);
    this.pump();
  }

  private pump() {
    while (this.running < CONCURRENCY && this.queue.length) {
      const task = this.queue.shift() as Task;
      this.running++;
      void this.run(task).finally(() => {
        this.running--;
        this.queued.delete(`${task.sub}:${task.image.id}`);
        this.pump();
      });
    }
  }

  private async run({ sub, image, channelName, data }: Task) {
    let status: 'ok' | 'failed' | 'missing' = 'failed';
    let driveFileId: string | undefined;
    try {
      const bytes = data ?? (await this.storage.read(image.fileUrl as string));
      driveFileId = await this.drive.backup(sub, {
        name: image.fileName || `imagen-${image.id}`,
        mimeType: image.mimeType || 'application/octet-stream',
        data: bytes,
        description: `Canal #${channelName} · enviada por ${image.author} · ${image.createdAt.toISOString()}`,
      });
      status = 'ok';
    } catch (e) {
      if (e instanceof FileMissingError) {
        status = 'missing';
        this.logger.warn(`Imagen ${image.id}: el archivo original ya no existe, no se puede respaldar`);
      } else {
        this.logger.error(`Respaldo en Drive fallo (imagen ${image.id}, cuenta ${sub}): ${(e as Error).message}`);
      }
    }
    // Si el mensaje se borro mientras tanto, esto falla y no importa.
    await this.prisma.driveBackup
      .update({ where: { sub_messageId: { sub, messageId: image.id } }, data: { status, driveFileId } })
      .catch(() => undefined);
    this.gateway.notifyBackup(sub, { id: image.id, channelId: image.channelId, driveStatus: status });
  }
}
