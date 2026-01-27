import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Edit2, Users, Target, Activity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { salesUserService, workspaceService } from '@/services/firestore';
import { useAuthStore } from '@/store/authStore';
import type { SalesUser, SalesUserType, SlackWorkspace } from '@/types';

interface TeamFormData {
  workspaceId: string;
  nombre: string;
  tipo: SalesUserType;
  hubspotOwnerId: string;
  slackUserId: string;
  slackChannel: string;
  metaSolicitudes: number;
  metaVentas: number;
  pipeline?: string;
  equipo?: string;
  gerenteId?: string;
}

const USER_TYPES: { value: SalesUserType; label: string; description: string }[] = [
  { value: 'kiosco', label: 'Kiosco', description: 'Gerente de kiosco con promotores' },
  { value: 'atn', label: 'ATN', description: 'Promotor Aviva Tu Negocio' },
  { value: 'ba', label: 'BA', description: 'Embajador Aviva Tu Compra' },
  { value: 'alianza', label: 'Alianza', description: 'Embajador de Alianzas' },
];

const PIPELINES = [
  { value: 'default', label: 'Default Pipeline' },
  { value: '76732496', label: 'Pipeline BAs (76732496)' },
];

export function Teams() {
  const { user } = useAuthStore();
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedType, setSelectedType] = useState<SalesUserType | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SalesUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculatingMetrics, setCalculatingMetrics] = useState<Set<string>>(new Set());
  const [calculatingAll, setCalculatingAll] = useState(false);

  const { register, handleSubmit, reset, watch } = useForm<TeamFormData>();

  const tipoSeleccionado = watch('tipo');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadSalesUsers(selectedWorkspace);
    }
  }, [selectedWorkspace]);

  const loadWorkspaces = async () => {
    try {
      const data = await workspaceService.getAll();
      setWorkspaces(data);
      if (data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0].id);
      }
    } catch (error) {
      toast.error('Error cargando workspaces');
      console.error(error);
    }
  };

  const loadSalesUsers = async (workspaceId: string) => {
    try {
      setLoading(true);
      const data = await salesUserService.getByWorkspace(workspaceId);
      setSalesUsers(data);
    } catch (error) {
      toast.error('Error cargando usuarios de ventas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetricsForUser = async (salesUser: SalesUser) => {
    setCalculatingMetrics(prev => new Set(prev).add(salesUser.id));

    try {
      const functions = getFunctions();
      const calculateSalesMetrics = httpsCallable(functions, 'calculateSalesMetrics');

      // Calculate week start and end dates
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const result = await calculateSalesMetrics({
        salesUserId: salesUser.id,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
      });

      const data = result.data as any;

      if (data.success) {
        toast.success(`Métricas calculadas para ${salesUser.nombre}`, {
          description: `Solicitudes: ${data.metrics.solicitudes} | Ventas: $${data.metrics.ventasReales.toLocaleString()} | Categoría: ${data.metrics.categoria}`,
        });
      }
    } catch (error: any) {
      console.error('Error calculando métricas:', error);
      toast.error(`Error calculando métricas para ${salesUser.nombre}`, {
        description: error.message || 'Error desconocido',
      });
    } finally {
      setCalculatingMetrics(prev => {
        const next = new Set(prev);
        next.delete(salesUser.id);
        return next;
      });
    }
  };

  const calculateAllMetrics = async () => {
    setCalculatingAll(true);

    try {
      const promises = filteredUsers.map(user => calculateMetricsForUser(user));
      await Promise.all(promises);
      toast.success('Métricas calculadas para todos los usuarios');
    } catch (error) {
      toast.error('Error calculando métricas');
      console.error(error);
    } finally {
      setCalculatingAll(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset({
      workspaceId: selectedWorkspace,
      nombre: '',
      tipo: 'kiosco',
      hubspotOwnerId: '',
      slackUserId: '',
      slackChannel: '',
      metaSolicitudes: 0,
      metaVentas: 0,
      pipeline: 'default',
      equipo: '',
      gerenteId: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (salesUser: SalesUser) => {
    setEditingUser(salesUser);
    reset({
      workspaceId: salesUser.workspaceId,
      nombre: salesUser.nombre,
      tipo: salesUser.tipo,
      hubspotOwnerId: salesUser.hubspotOwnerId,
      slackUserId: salesUser.slackUserId,
      slackChannel: salesUser.slackChannel,
      metaSolicitudes: salesUser.metaSolicitudes,
      metaVentas: salesUser.metaVentas,
      pipeline: salesUser.pipeline || 'default',
      equipo: salesUser.equipo || '',
      gerenteId: salesUser.gerenteId || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: TeamFormData) => {
    try {
      const salesUserData: any = {
        workspaceId: data.workspaceId,
        nombre: data.nombre,
        tipo: data.tipo,
        hubspotOwnerId: data.hubspotOwnerId,
        slackUserId: data.slackUserId,
        slackChannel: data.slackChannel,
        metaSolicitudes: Number(data.metaSolicitudes),
        metaVentas: Number(data.metaVentas),
        pipeline: data.pipeline || 'default',
        isActive: true,
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.equipo && data.equipo.trim()) {
        salesUserData.equipo = data.equipo;
      }
      if (data.gerenteId && data.gerenteId.trim()) {
        salesUserData.gerenteId = data.gerenteId;
      }

      if (editingUser) {
        await salesUserService.update(editingUser.id, {
          ...salesUserData,
          updatedAt: Timestamp.now(),
        });
        toast.success('Usuario actualizado exitosamente');
      } else {
        await salesUserService.create({
          ...salesUserData,
          createdBy: user?.id || 'mock-user-id',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Usuario creado exitosamente');
      }

      setIsModalOpen(false);
      loadSalesUsers(selectedWorkspace);
    } catch (error) {
      toast.error('Error guardando usuario');
      console.error(error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await salesUserService.delete(userId);
      toast.success('Usuario eliminado exitosamente');
      loadSalesUsers(selectedWorkspace);
    } catch (error) {
      toast.error('Error eliminando usuario');
      console.error(error);
    }
  };

  const filteredUsers = selectedType === 'all'
    ? salesUsers
    : salesUsers.filter(u => u.tipo === selectedType);

  const getUserTypeLabel = (tipo: SalesUserType) => {
    const typeObj = USER_TYPES.find(t => t.value === tipo);
    return typeObj?.label || tipo;
  };

  const getUserTypeColor = (tipo: SalesUserType) => {
    const colors: Record<SalesUserType, string> = {
      kiosco: 'bg-blue-100 text-blue-800',
      atn: 'bg-green-100 text-green-800',
      ba: 'bg-purple-100 text-purple-800',
      alianza: 'bg-orange-100 text-orange-800',
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipos de Ventas</h1>
          <p className="mt-2 text-gray-600">
            Gestiona usuarios, metas y métricas de desempeño
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2 bg-slack-purple text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Agregar Usuario</span>
        </button>
      </div>

      {/* Workspace & Type Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace
            </label>
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Usuario
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as SalesUserType | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            >
              <option value="all">Todos los tipos</option>
              {USER_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Usuarios</p>
              <p className="text-2xl font-bold text-gray-900">{salesUsers.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {USER_TYPES.map((type) => {
          const count = salesUsers.filter(u => u.tipo === type.value).length;
          return (
            <div key={type.value} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{type.label}s</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
                <Target className="w-8 h-8 text-slack-purple" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Users List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando usuarios...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay usuarios de ventas
          </h3>
          <p className="text-gray-600 mb-6">
            Comienza agregando tu primer usuario de ventas
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slack-purple text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Agregar Usuario</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map((salesUser) => (
            <div
              key={salesUser.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {salesUser.nombre}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getUserTypeColor(
                        salesUser.tipo
                      )}`}
                    >
                      {getUserTypeLabel(salesUser.tipo)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500">HubSpot Owner ID</p>
                      <p className="text-sm font-medium text-gray-900">
                        {salesUser.hubspotOwnerId}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Slack Channel</p>
                      <p className="text-sm font-medium text-gray-900">
                        {salesUser.slackChannel}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Meta Solicitudes</p>
                      <p className="text-sm font-medium text-gray-900">
                        {salesUser.metaSolicitudes}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Meta Ventas</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${salesUser.metaVentas.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {salesUser.equipo && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">Equipo</p>
                      <p className="text-sm font-medium text-gray-900">
                        {salesUser.equipo}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => openEditModal(salesUser)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar usuario"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteUser(salesUser.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario de Ventas'}
                </h2>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Workspace */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workspace *
                    </label>
                    <select
                      {...register('workspaceId', { required: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nombre */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre *
                    </label>
                    <input
                      {...register('nombre', { required: true })}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Usuario *
                    </label>
                    <select
                      {...register('tipo', { required: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    >
                      {USER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* HubSpot Owner ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HubSpot Owner ID *
                    </label>
                    <input
                      {...register('hubspotOwnerId', { required: true })}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Ej: 123456789"
                    />
                  </div>

                  {/* Slack User ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Slack User ID *
                    </label>
                    <input
                      {...register('slackUserId', { required: true })}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Ej: U01234ABC"
                    />
                  </div>

                  {/* Slack Channel */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Slack Channel *
                    </label>
                    <input
                      {...register('slackChannel', { required: true })}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Ej: C01234ABC o #nombre-canal"
                    />
                  </div>

                  {/* Meta Solicitudes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Solicitudes Semanal *
                    </label>
                    <input
                      {...register('metaSolicitudes', { required: true, valueAsNumber: true })}
                      type="number"
                      step="1"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Ej: 50"
                    />
                  </div>

                  {/* Meta Ventas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Ventas Semanal (MXN) *
                    </label>
                    <input
                      {...register('metaVentas', { required: true, valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Ej: 500000"
                    />
                  </div>

                  {/* Pipeline */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pipeline
                    </label>
                    <select
                      {...register('pipeline')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    >
                      {PIPELINES.map((pipeline) => (
                        <option key={pipeline.value} value={pipeline.value}>
                          {pipeline.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Equipo (solo para Kioscos) */}
                  {tipoSeleccionado === 'kiosco' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre del Equipo
                        </label>
                        <input
                          {...register('equipo')}
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                          placeholder="Ej: Kiosco Centro"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ID del Gerente
                        </label>
                        <input
                          {...register('gerenteId')}
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                          placeholder="Opcional"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Las metas son semanales. El sistema calculará
                    automáticamente el progreso esperado según el día de la semana.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slack-purple text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
