import { useCallback, useEffect, useState } from 'react';

type Channel = { id: number; name: string; roleIds: number[] };
type Role = { id: number; name: string };
type UserRow = { id: number; name: string; roleId: number };
type Props = {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  channels: Channel[];
  onChanged: () => void;
  onClose: () => void;
};

export default function AdminPanel({ authFetch, channels, onChanged, onClose }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [autoAdmin, setAutoAdmin] = useState(true);
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState('');

  const get = useCallback(
    (path: string) => authFetch(path).then(r => (r.ok ? r.json() : null)),
    [authFetch],
  );

  const load = useCallback(async () => {
    const [r, u, s] = await Promise.all([get('/roles'), get('/users'), get('/settings')]);
    setRoles(r ?? []);
    setUsers(u ?? []);
    setAutoAdmin(s?.autoAdmin ?? true);
  }, [get]);

  useEffect(() => { load(); }, [load, channels]);

  const send = async (path: string, method: string, body: unknown) => {
    const res = await authFetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.message ?? 'Error');
      return false;
    }
    setError('');
    return true;
  };

  const toggleAutoAdmin = async (on: boolean) => {
    if (await send('/settings', 'PATCH', { autoAdmin: on })) setAutoAdmin(on);
  };

  const createRole = async () => {
    if (!newRole.trim()) return;
    if (await send('/roles', 'POST', { name: newRole.trim() })) {
      setNewRole('');
      load();
    }
  };

  const changeUserRole = async (userId: number, roleId: number) => {
    if (await send(`/users/${userId}`, 'PATCH', { roleId })) {
      load();
      onChanged();
    }
  };

  const toggleChannelRole = async (c: Channel, roleId: number) => {
    const roleIds = c.roleIds.includes(roleId) ? c.roleIds.filter(r => r !== roleId) : [...c.roleIds, roleId];
    if (await send(`/channels/${c.id}/roles`, 'PATCH', { roleIds })) onChanged();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-xl font-bold">Administracion</h1>
        <button className="border px-3" onClick={onClose}>Cerrar</button>
      </div>
      {error && <p className="bg-red-100 p-1 text-red-700">{error}</p>}

      <section>
        <h2 className="font-bold">Nuevos usuarios</h2>
        <label className="flex gap-2">
          <input type="checkbox" checked={autoAdmin} onChange={e => toggleAutoAdmin(e.target.checked)} />
          Los que entren por primera vez son administradores (si lo desactivas entran como empleado)
        </label>
      </section>

      <section>
        <h2 className="font-bold">Roles</h2>
        <p>{roles.map(r => r.name).join(', ')}</p>
        <div className="flex gap-2 mt-1">
          <input className="border p-1" placeholder="nuevo rol" value={newRole}
            onChange={e => setNewRole(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createRole()} />
          <button className="border px-3" onClick={createRole}>Crear rol</button>
        </div>
      </section>

      <section>
        <h2 className="font-bold">Usuarios</h2>
        {users.map(u => (
          <div key={u.id} className="flex gap-2 items-center">
            <span className="w-48 truncate">{u.name}</span>
            <select className="border p-1" value={u.roleId} onChange={e => changeUserRole(u.id, Number(e.target.value))}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-bold">Quien ve cada canal</h2>
        <p className="text-sm text-gray-500">Sin ningun rol marcado, el canal lo ven todos. El administrador ve todos los canales.</p>
        {channels.map(c => (
          <div key={c.id} className="flex gap-3 items-center flex-wrap">
            <span className="w-32 truncate"># {c.name}</span>
            {roles.map(r => (
              <label key={r.id} className="flex gap-1">
                <input type="checkbox" checked={c.roleIds.includes(r.id)} onChange={() => toggleChannelRole(c, r.id)} />
                {r.name}
              </label>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
