import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { usersDb } from '@/config/firebase';
import { useAuthStore } from '@/store/authStore';
import { User, UserRole } from '@/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import {
  UserPlus,
  Trash2,
  Users,
  Mail,
  ShieldCheck,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface Invitation {
  email: string;
  role: UserRole;
  createdAt: Timestamp;
  createdBy: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  viewer: 'Visor',
  editor: 'Editor',
  admin: 'Admin',
};

const ROLE_COLORS: Record<UserRole, string> = {
  viewer: 'bg-gray-100 text-gray-700',
  editor: 'bg-blue-100 text-blue-700',
  admin: 'bg-purple-100 text-purple-700',
};

function formatDate(ts: Timestamp | undefined) {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function UsersAdmin() {
  const { user: currentUser } = useAuthStore();
  const [tab, setTab] = useState<'users' | 'invitations'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [savingInvite, setSavingInvite] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [deletingInvite, setDeletingInvite] = useState<string | null>(null);

  async function loadData() {
    setLoadingData(true);
    try {
      const [usersSnap, invitesSnap] = await Promise.all([
        getDocs(collection(usersDb, 'users')),
        getDocs(collection(usersDb, 'invitations')),
      ]);

      const loadedUsers = usersSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as User)
      );
      const loadedInvites = invitesSnap.docs.map((d) => ({
        email: d.id,
        ...d.data(),
      } as Invitation));

      loadedUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));
      loadedInvites.sort((a, b) => a.email.localeCompare(b.email));

      setUsers(loadedUsers);
      setInvitations(loadedInvites);
    } catch (err) {
      toast.error('Error al cargar datos');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateInvite() {
    setEmailError('');
    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setEmailError('El correo es requerido');
      return;
    }
    if (!email.endsWith('@avivacredito.com')) {
      setEmailError('Solo se permiten cuentas @avivacredito.com');
      return;
    }
    if (invitations.some((i) => i.email === email)) {
      setEmailError('Ya existe una invitación para este correo');
      return;
    }
    if (users.some((u) => u.email === email)) {
      setEmailError('Este usuario ya tiene acceso a la herramienta');
      return;
    }

    setSavingInvite(true);
    try {
      await setDoc(doc(usersDb, 'invitations', email), {
        role: inviteRole,
        createdAt: Timestamp.now(),
        createdBy: currentUser?.email ?? '',
      });
      toast.success(`Invitación enviada a ${email}`);
      setInviteEmail('');
      setInviteRole('viewer');
      setShowInviteModal(false);
      await loadData();
    } catch (err) {
      toast.error('Error al crear la invitación');
    } finally {
      setSavingInvite(false);
    }
  }

  async function handleDeleteInvite(email: string) {
    setDeletingInvite(email);
    try {
      await deleteDoc(doc(usersDb, 'invitations', email));
      toast.success('Invitación eliminada');
      setInvitations((prev) => prev.filter((i) => i.email !== email));
    } catch (err) {
      toast.error('Error al eliminar la invitación');
    } finally {
      setDeletingInvite(null);
    }
  }

  async function handleUpdateRole(userId: string, newRole: UserRole) {
    setUpdatingRole(userId);
    try {
      await updateDoc(doc(usersDb, 'users', userId), { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success('Rol actualizado');
    } catch (err) {
      toast.error('Error al actualizar el rol');
    } finally {
      setUpdatingRole(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Usuarios y Accesos
          </h1>
          <p className="text-gray-500 mt-1">
            Gestiona quién puede acceder a la herramienta
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loadingData}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {tab === 'invitations' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setInviteEmail('');
                setInviteRole('viewer');
                setEmailError('');
                setShowInviteModal(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Nueva invitación
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('users')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'users'
                ? 'border-slack-purple text-slack-purple'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuarios activos
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {users.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setTab('invitations')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'invitations'
                ? 'border-slack-purple text-slack-purple'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Invitaciones pendientes
              {invitations.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                  {invitations.length}
                </span>
              )}
            </div>
          </button>
        </nav>
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <Card>
          {loadingData ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No hay usuarios registrados aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Usuario
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Correo
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Rol
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Último acceso
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt={u.displayName}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slack-purple text-white flex items-center justify-center text-sm font-medium">
                              {u.displayName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">
                            {u.displayName}
                            {u.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-gray-400">(tú)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{u.email}</td>
                      <td className="py-3 px-4">
                        {u.id === currentUser?.id ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            {ROLE_LABELS[u.role]}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            disabled={updatingRole === u.id}
                            onChange={(e) =>
                              handleUpdateRole(u.id, e.target.value as UserRole)
                            }
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slack-purple bg-white disabled:opacity-50"
                          >
                            <option value="viewer">Visor</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(u.lastLogin)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Invitations tab */}
      {tab === 'invitations' && (
        <Card>
          {loadingData ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                No hay invitaciones pendientes
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Crea una invitación para dar acceso a un compañero de Aviva.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setInviteEmail('');
                  setInviteRole('viewer');
                  setEmailError('');
                  setShowInviteModal(true);
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Nueva invitación
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Correo invitado
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Rol asignado
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Creada
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Invitado por
                    </th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invitations.map((inv) => (
                    <tr key={inv.email} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {inv.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[inv.role]}`}
                        >
                          {ROLE_LABELS[inv.role]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {inv.createdBy || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deletingInvite === inv.email}
                          onClick={() => handleDeleteInvite(inv.email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* New invitation modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Nueva invitación"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="nombre@avivacredito.com"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setEmailError('');
            }}
            error={emailError}
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slack-purple bg-white text-sm"
            >
              <option value="viewer">Visor — solo lectura</option>
              <option value="editor">Editor — crear y gestionar contenido</option>
              <option value="admin">Admin — acceso completo</option>
            </select>
          </div>

          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            El usuario podrá acceder la próxima vez que inicie sesión con Google usando este correo.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowInviteModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={savingInvite}
              onClick={handleCreateInvite}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Enviar invitación
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
