import { useState, useEffect } from 'react';
import { Users, Target, Activity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { salesUserService, workspaceService, positionService } from '@/services/firestore';
import type { SalesUser, SalesUserType, SlackWorkspace, Position } from '@/types';


export function Teams() {
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedType, setSelectedType] = useState<SalesUserType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [calculatingMetrics, setCalculatingMetrics] = useState<Set<string>>(new Set());
  const [calculatingAll, setCalculatingAll] = useState(false);

  useEffect(() => {
    loadWorkspaces();
    positionService.getAll().then(setPositions).catch(console.error);
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

  const filteredUsers = selectedType === 'all'
    ? salesUsers
    : salesUsers.filter(u => u.tipo === selectedType);

  const getUserTypeLabel = (tipo: SalesUserType) => tipo;

  const POSITION_COLORS = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
    'bg-pink-100 text-pink-800',
    'bg-teal-100 text-teal-800',
  ];

  const getUserTypeColor = (tipo: SalesUserType) => {
    const idx = positions.findIndex(p => p.name === tipo);
    return idx >= 0 ? POSITION_COLORS[idx % POSITION_COLORS.length] : 'bg-gray-100 text-gray-800';
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
          onClick={calculateAllMetrics}
          disabled={calculatingAll || filteredUsers.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calculatingAll ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Calculando...</span>
            </>
          ) : (
            <>
              <Activity className="w-5 h-5" />
              <span>Calcular Métricas</span>
            </>
          )}
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
              {positions.map((pos) => (
                <option key={pos.id} value={pos.name}>
                  {pos.name}
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

        {positions.slice(0, 3).map((pos) => {
          const count = salesUsers.filter(u => u.tipo === pos.name).length;
          return (
            <div key={pos.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 truncate" title={pos.name}>{pos.name}</p>
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
          <p className="text-gray-600">
            Los usuarios se gestionan desde el proyecto externo de Firebase.
          </p>
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
                      <p className="text-xs text-gray-500">Canal de Slack</p>
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
                    onClick={() => calculateMetricsForUser(salesUser)}
                    disabled={calculatingMetrics.has(salesUser.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Calcular métricas"
                  >
                    {calculatingMetrics.has(salesUser.id) ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Activity className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
