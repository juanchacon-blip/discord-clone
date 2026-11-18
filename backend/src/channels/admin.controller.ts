import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, UsersService } from '../users/users.service';
import { ChannelsGateway } from './channels.gateway';

@UseGuards(AuthGuard)
@Controller()
export class AdminController {
  constructor(private users: UsersService, private gateway: ChannelsGateway) {}

  @Get('me')
  me(@Req() req: { user: CurrentUser }) {
    const { name, roleName, isAdmin } = req.user;
    return { name, role: roleName, isAdmin };
  }

  @Get('roles')
  @UseGuards(AdminGuard)
  roles() {
    return this.users.listRoles();
  }

  @Post('roles')
  @UseGuards(AdminGuard)
  createRole(@Body() body: { name: string }) {
    return this.users.createRole(body.name);
  }

  @Get('users')
  @UseGuards(AdminGuard)
  listUsers() {
    return this.users.listUsers();
  }

  @Patch('users/:id')
  @UseGuards(AdminGuard)
  async setUserRole(@Param('id', ParseIntPipe) id: number, @Body() body: { roleId: number }) {
    const user = await this.users.setUserRole(id, body.roleId);
    await this.gateway.refresh();
    return user;
  }

  // Si autoAdmin esta activo, los usuarios nuevos entran como administrador;
  // si no, entran como empleado.
  @Get('settings')
  @UseGuards(AdminGuard)
  async settings() {
    return { autoAdmin: await this.users.autoAdmin() };
  }

  @Patch('settings')
  @UseGuards(AdminGuard)
  async setSettings(@Body() body: { autoAdmin: boolean }) {
    await this.users.setAutoAdmin(body.autoAdmin === true);
    return { autoAdmin: await this.users.autoAdmin() };
  }
}
