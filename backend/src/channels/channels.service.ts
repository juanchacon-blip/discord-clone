import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Limites basicos: ahora que la app es publica, cualquiera puede mandar datos.
const MAX_CHANNEL_NAME = 50;
const MAX_AUTHOR = 32;
const MAX_CONTENT = 2000;

type Stored = {
  id: number; content: string; author: string; channelId: number; createdAt: Date;
  fileName: string | null; fileUrl: string | null; mimeType: string | null;
};

// Lo que ve el navegador. Datos internos (clave de storage, id de Drive, sub) nunca salen.
// El estado del respaldo en Drive es de cada espectador (su propio Drive), nunca del mensaje.
export function toPublic(m: Stored, driveStatus: string | null = null) {
  return {
    id: m.id, content: m.content, author: m.author, channelId: m.channelId, createdAt: m.createdAt,
    fileName: m.fileName, fileUrl: m.fileUrl, mimeType: m.mimeType,
    driveStatus,
  };
}

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async create(name: string) {
    const clean = String(name ?? '').trim().slice(0, MAX_CHANNEL_NAME);
    if (!clean) throw new BadRequestException('Nombre de canal invalido');
    const c = await this.prisma.channel.create({ data: { name: clean } });
    return { id: c.id, name: c.name };
  }

  /** Canales de la cuenta, cada uno con cuantos mensajes ajenos lleva sin leer. */
  async findAll(sub: string) {
    const channels = await this.prisma.channel.findMany({ orderBy: { id: 'asc' } });
    const reads = await this.prisma.channelRead.findMany({ where: { sub } });
    const lastRead = new Map<number, number>(reads.map((r) => [r.channelId, r.lastReadId]));

    // Primera vez que esta cuenta ve un canal: lo que ya habia cuenta como leido
    // (si no, al estrenar esta funcion saldrian cientos de "no leidos" viejos).
    const fresh = channels.filter((c) => !lastRead.has(c.id));
    if (fresh.length) {
      const maxes = await this.prisma.message.groupBy({
        by: ['channelId'],
        where: { channelId: { in: fresh.map((c) => c.id) } },
        _max: { id: true },
      });
      const maxBy = new Map<number, number>(maxes.map((m) => [m.channelId, m._max.id ?? 0]));
      await this.prisma.channelRead.createMany({
        data: fresh.map((c) => ({ sub, channelId: c.id, lastReadId: maxBy.get(c.id) ?? 0 })),
        skipDuplicates: true,
      });
      for (const c of fresh) lastRead.set(c.id, maxBy.get(c.id) ?? 0);
    }

    const counts = await Promise.all(
      channels.map((c) =>
        this.prisma.message.count({
          where: {
            channelId: c.id,
            id: { gt: lastRead.get(c.id) ?? 0 },
            // Tus propios mensajes no cuentan como "sin leer" (los antiguos no tienen autor guardado).
            OR: [{ authorSub: null }, { authorSub: { not: sub } }],
          },
        }),
      ),
    );
    return channels.map((c, i) => ({ id: c.id, name: c.name, unread: counts[i] }));
  }

  /** Marca el canal como leido hasta su ultimo mensaje. */
  async markRead(sub: string, channelId: number) {
    await this.assertExists(channelId);
    const max = await this.prisma.message.aggregate({ where: { channelId }, _max: { id: true } });
    const lastReadId = max._max.id ?? 0;
    await this.prisma.channelRead.upsert({
      where: { sub_channelId: { sub, channelId } },
      create: { sub, channelId, lastReadId },
      update: { lastReadId },
    });
  }

  async allIds(): Promise<number[]> {
    return (await this.prisma.channel.findMany({ select: { id: true } })).map(c => c.id);
  }

  async assertExists(channelId: number) {
    const n = await this.prisma.channel.count({ where: { id: channelId } });
    if (!n) throw new NotFoundException('El canal no existe');
  }

  async history(channelId: number, viewerSub?: string) {
    await this.assertExists(channelId);
    const msgs = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const ordered = msgs.reverse();
    // Estado del respaldo de cada imagen en el Drive de QUIEN mira (no el de los demas).
    const ids = ordered.filter(m => m.fileUrl).map(m => m.id);
    const rows = viewerSub && ids.length
      ? await this.prisma.driveBackup.findMany({ where: { sub: viewerSub, messageId: { in: ids } }, select: { messageId: true, status: true } })
      : [];
    const status = new Map<number, string>(rows.map(r => [r.messageId, r.status]));
    return ordered.map(m => toPublic(m, status.get(m.id) ?? null));
  }

  async createMessage(
    channelId: number,
    author: string,
    content: string,
    authorSub: string,
    file?: { fileName: string; fileUrl: string; mimeType: string; storageKey: string },
  ) {
    const cleanAuthor = String(author ?? '').trim().slice(0, MAX_AUTHOR);
    const cleanContent = String(content ?? '').trim().slice(0, MAX_CONTENT);
    if (!Number.isInteger(channelId) || !cleanAuthor || (!cleanContent && !file)) {
      throw new BadRequestException('Mensaje invalido');
    }
    return this.prisma.message.create({
      data: { channelId, author: cleanAuthor, authorSub, content: cleanContent, ...file },
    });
  }
}
