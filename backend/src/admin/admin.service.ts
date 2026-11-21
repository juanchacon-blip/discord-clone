import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { toPublic } from '../channels/channels.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const PAGE_SIZE = 50;

@Injectable()
export class AdminService {
  private logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService, private storage: StorageService) {}

  /** Canales con cuantos mensajes y archivos tiene cada uno. */
  async channels() {
    const [list, files] = await Promise.all([
      this.prisma.channel.findMany({
        orderBy: { id: 'asc' },
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.message.groupBy({
        by: ['channelId'],
        where: { fileUrl: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const byChannel = new Map(files.map((f) => [f.channelId, f._count._all]));
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      messages: c._count.messages,
      files: byChannel.get(c.id) ?? 0,
    }));
  }

  /** Mensajes de un canal, del mas nuevo al mas viejo, de 50 en 50. */
  async messages(channelId: number, before?: number, onlyFiles = false) {
    await this.assertChannel(channelId);
    const rows = await this.prisma.message.findMany({
      where: {
        channelId,
        ...(before ? { id: { lt: before } } : {}),
        ...(onlyFiles ? { fileUrl: { not: null } } : {}),
      },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      messages: page.map((m) => toPublic(m)),
      nextBefore: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  /** Borra el canal con todos sus mensajes y archivos. */
  async deleteChannel(id: number) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException('El canal no existe');
    const withFiles = await this.prisma.message.findMany({
      where: { channelId: id, fileUrl: { not: null } },
      select: { fileUrl: true },
    });
    // Primero la base de datos (el contenido desaparece de la app de inmediato)...
    const [deleted] = await this.prisma.$transaction([
      this.prisma.message.deleteMany({ where: { channelId: id } }),
      this.prisma.channel.delete({ where: { id } }),
    ]);
    // ...despues los archivos. Si alguno falla se avisa, pero el canal ya no existe.
    const storageErrors = await this.removeFiles(withFiles.map((m) => m.fileUrl as string));
    return { name: channel.name, deletedMessages: deleted.count, storageErrors };
  }

  async deleteMessage(id: number) {
    const msg = await this.prisma.message.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('El mensaje no existe');
    await this.prisma.message.delete({ where: { id } });
    const storageErrors = msg.fileUrl ? await this.removeFiles([msg.fileUrl]) : 0;
    return { channelId: msg.channelId, storageErrors };
  }

  /**
   * Borra solo la imagen/archivo de un mensaje.
   * Si el mensaje no tenia texto, no queda nada que mostrar y se borra completo.
   */
  async deleteMessageFile(id: number) {
    const msg = await this.prisma.message.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('El mensaje no existe');
    if (!msg.fileUrl) throw new BadRequestException('El mensaje no tiene archivo');

    if (!msg.content.trim()) {
      const r = await this.deleteMessage(id);
      return { ...r, messageDeleted: true as const };
    }
    const updated = await this.prisma.message.update({
      where: { id },
      data: { fileName: null, fileUrl: null, mimeType: null, storageKey: null, driveStatus: null, driveFileId: null },
    });
    const storageErrors = await this.removeFiles([msg.fileUrl]);
    return { channelId: msg.channelId, storageErrors, messageDeleted: false as const, message: toPublic(updated) };
  }

  /** Borra archivos de a 5 a la vez. Devuelve cuantos NO se pudieron borrar. */
  private async removeFiles(urls: string[]): Promise<number> {
    let failed = 0;
    for (let i = 0; i < urls.length; i += 5) {
      const results = await Promise.allSettled(urls.slice(i, i + 5).map((u) => this.storage.remove(u)));
      for (const r of results) {
        if (r.status === 'rejected') {
          failed++;
          this.logger.error(`No se pudo borrar un archivo del almacenamiento: ${(r.reason as Error).message}`);
        }
      }
    }
    return failed;
  }

  private async assertChannel(id: number) {
    if (!(await this.prisma.channel.count({ where: { id } }))) throw new NotFoundException('El canal no existe');
  }
}
