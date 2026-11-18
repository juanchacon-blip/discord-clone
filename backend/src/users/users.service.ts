import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

export const ADMIN_ROLE = 'administrador';
export const DEFAULT_ROLE = 'empleado';

export type CurrentUser = {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  isAdmin: boolean;
};

type UserWithRole = { id: number; name: string; roleId: number; role: { name: string } };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private toCurrent(u: UserWithRole): CurrentUser {
    return {
      id: u.id,
      name: u.name,
      roleId: u.roleId,
      roleName: u.role.name,
      isAdmin: u.role.name === ADMIN_ROLE,
    };
  }

  /** Busca al usuario de Auth0 en la base; si es la primera vez que entra, le asigna rol. */
  async ensure(auth: AuthUser): Promise<CurrentUser> {
    const include = { role: true };
    let user = await this.prisma.user.findUnique({ where: { sub: auth.sub }, include });
    if (!user) {
      const role = await this.prisma.role.findUniqueOrThrow({
        where: { name: (await this.autoAdmin()) ? ADMIN_ROLE : DEFAULT_ROLE },
      });
      user = await this.prisma.user.upsert({
        where: { sub: auth.sub },
        update: {},
        create: { sub: auth.sub, name: auth.name, roleId: role.id },
        include,
      });
    } else if (user.name !== auth.name) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { name: auth.name }, include });
    }
    return this.toCurrent(user);
  }

  async byId(id: number): Promise<CurrentUser> {
    return this.toCurrent(await this.prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true } }));
  }

  async autoAdmin(): Promise<boolean> {
    const s = await this.prisma.setting.findUnique({ where: { key: 'autoAdmin' } });
    return s?.value !== 'false';
  }

  setAutoAdmin(on: boolean) {
    const value = String(on);
    return this.prisma.setting.upsert({
      where: { key: 'autoAdmin' },
      update: { value },
      create: { key: 'autoAdmin', value },
    });
  }

  listRoles() {
    return this.prisma.role.findMany({ orderBy: { id: 'asc' } });
  }

  async createRole(name: string) {
    const clean = String(name ?? '').trim().slice(0, 32);
    if (!clean) throw new BadRequestException('Nombre de rol invalido');
    const exists = await this.prisma.role.findFirst({
      where: { name: { equals: clean, mode: 'insensitive' } },
    });
    if (exists) throw new BadRequestException('Ese rol ya existe');
    return this.prisma.role.create({ data: { name: clean } });
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({ orderBy: { id: 'asc' } });
    return users.map(u => ({ id: u.id, name: u.name, roleId: u.roleId }));
  }

  async setUserRole(userId: number, roleId: number) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } }),
      this.prisma.role.findUnique({ where: { id: Number(roleId) } }),
    ]);
    if (!user || !role) throw new NotFoundException('Usuario o rol no existe');
    if (user.role.name === ADMIN_ROLE && role.name !== ADMIN_ROLE) {
      const admins = await this.prisma.user.count({ where: { role: { name: ADMIN_ROLE } } });
      if (admins <= 1) throw new BadRequestException('Debe quedar al menos un administrador');
    }
    return this.prisma.user.update({ where: { id: userId }, data: { roleId: role.id } });
  }
}
