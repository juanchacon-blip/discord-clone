import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../users/users.service';

// Limites basicos: ahora que la app es publica, cualquiera puede mandar datos.
const MAX_CHANNEL_NAME = 50;
const MAX_AUTHOR = 32;
const MAX_CONTENT = 2000;

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  // El administrador ve todo. Los demas: canales sin roles, o con su rol.
  private visibleTo(user: CurrentUser) {
    if (user.isAdmin) return {};
    return { OR: [{ roles: { none: {} } }, { roles: { some: { roleId: user.roleId } } }] };
  }

  private async validRoleIds(roleIds: unknown): Promise<number[]> {
    const ids = (Array.isArray(roleIds) ? roleIds : []).map(Number).filter(Number.isInteger);
    const roles = await this.prisma.role.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return roles.map(r => r.id);
  }

  async create(name: string, roleIds?: number[]) {
    const clean = String(name ?? '').trim().slice(0, MAX_CHANNEL_NAME);
    if (!clean) throw new BadRequestException('Nombre de canal invalido');
    const ids = await this.validRoleIds(roleIds);
    const c = await this.prisma.channel.create({
      data: { name: clean, roles: { create: ids.map(roleId => ({ roleId })) } },
    });
    return { id: c.id, name: c.name, roleIds: ids };
  }

  async setRoles(channelId: number, roleIds: number[]) {
    const ids = await this.validRoleIds(roleIds);
    await this.prisma.$transaction([
      this.prisma.channelRole.deleteMany({ where: { channelId } }),
      this.prisma.channelRole.createMany({ data: ids.map(roleId => ({ channelId, roleId })) }),
    ]);
    return { id: channelId, roleIds: ids };
  }

  async findAll(user: CurrentUser) {
    const list = await this.prisma.channel.findMany({
      where: this.visibleTo(user),
      include: { roles: true },
      orderBy: { id: 'asc' },
    });
    return list.map(c => ({ id: c.id, name: c.name, roleIds: c.roles.map(r => r.roleId) }));
  }

  async accessibleIds(user: CurrentUser): Promise<number[]> {
    const list = await this.prisma.channel.findMany({ where: this.visibleTo(user), select: { id: true } });
    return list.map(c => c.id);
  }

  async allIds(): Promise<number[]> {
    return (await this.prisma.channel.findMany({ select: { id: true } })).map(c => c.id);
  }

  async assertAccess(user: CurrentUser, channelId: number) {
    const n = await this.prisma.channel.count({ where: { id: channelId, ...this.visibleTo(user) } });
    if (!n) throw new ForbiddenException('No tienes acceso a este canal');
  }

  async history(user: CurrentUser, channelId: number) {
    await this.assertAccess(user, channelId);
    const msgs = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return msgs.reverse();
  }

  createMessage(
    channelId: number,
    author: string,
    content: string,
    file?: { fileName: string; fileUrl: string },
  ) {
    const cleanAuthor = String(author ?? '').trim().slice(0, MAX_AUTHOR);
    const cleanContent = String(content ?? '').trim().slice(0, MAX_CONTENT);
    if (!Number.isInteger(channelId) || !cleanAuthor || (!cleanContent && !file)) {
      throw new BadRequestException('Mensaje invalido');
    }
    return this.prisma.message.create({
      data: { channelId, author: cleanAuthor, content: cleanContent, ...file },
    });
  }
}
