import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Bell,
  Plus,
  Trash2,
  Save,
  X,
  Building2,
  GitBranch,
  Layers,
  GripVertical,
  Sparkles,
  FileSpreadsheet,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import {
  workspaceService,
  workspaceSettingsService,
  pipelineService,
  dataSourceService,
} from '@/services/firestore';
import type {
  SlackWorkspace,
  WorkspaceSettings,
  Pipeline,
  PipelineStage,
  StageCategory,
  DataSource,
  DataSourceVariable,
  DataSourceType,
  DateRangeType,
} from '@/types';

type Tab = 'pipelines' | 'datasources' | 'general' | 'notifications';

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch, description: 'Configura tus pipelines de HubSpot' },
  { id: 'datasources', label: 'Fuentes de Datos', icon: Database, description: 'Define de dónde obtener información' },
  { id: 'general', label: 'General', icon: SettingsIcon, description: 'Preferencias generales' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, description: 'Alertas y avisos' },
];

const STAGE_CATEGORIES: { value: StageCategory; label: string; color: string; description: string }[] = [
  { value: 'new', label: 'Nuevo', color: 'bg-blue-500', description: 'Recién creado' },
  { value: 'in_progress', label: 'En proceso', color: 'bg-yellow-500', description: 'Trabajando en ello' },
  { value: 'advanced', label: 'Avanzado', color: 'bg-purple-500', description: 'Progreso significativo' },
  { value: 'won', label: 'Ganado', color: 'bg-green-500', description: 'Cerrado exitosamente' },
  { value: 'lost', label: 'Perdido', color: 'bg-red-500', description: 'No se concretó' },
];

const DATA_SOURCE_TYPES: { value: DataSourceType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'pipeline', label: 'Pipeline de HubSpot', icon: GitBranch, description: 'Métricas de un pipeline específico' },
  { value: 'property', label: 'Propiedades HubSpot', icon: Layers, description: 'Propiedades específicas de contactos o negocios' },
  { value: 'google_sheets', label: 'Google Sheets', icon: FileSpreadsheet, description: 'Datos de una hoja de cálculo' },
  { value: 'api', label: 'API Externa', icon: Globe, description: 'Datos de un endpoint externo' },
];

const DATE_RANGES: { value: DateRangeType; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana pasada' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este año' },
];

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Monterrey', label: 'Monterrey (GMT-6)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
];

const PIPELINE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const PIPELINE_ICONS = ['💼', '🏪', '🤝', '📈', '🎯', '💰', '🚀', '⭐', '🔥', '💎'];

// Helper to create empty pipeline
const createEmptyPipeline = (workspaceId: string): Omit<Pipeline, 'id'> => ({
  workspaceId,
  name: '',
  hubspotPipelineId: '',
  icon: '💼',
  color: '#6366f1',
  stages: [],
  countMetric: 'deals',
  isActive: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

// Helper to create empty data source
const createEmptyDataSource = (workspaceId: string): Omit<DataSource, 'id'> => ({
  workspaceId,
  name: '',
  type: 'pipeline',
  icon: '📊',
  dateRange: 'this_week',
  variables: [],
  isActive: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

// Helper to create empty stage
const createEmptyStage = (order: number): PipelineStage => ({
  id: `stage_${Date.now()}_${order}`,
  name: '',
  category: 'new',
  order,
});

// Helper to create empty variable
const createEmptyVariable = (): DataSourceVariable => ({
  key: '',
  label: '',
  type: 'number',
});

export function Settings() {
  const { selectedWorkspace } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('pipelines');
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [_settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Pipeline modal state
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [pipelineForm, setPipelineForm] = useState<Omit<Pipeline, 'id'>>(createEmptyPipeline(''));
  const [savingPipeline, setSavingPipeline] = useState(false);

  // DataSource modal state
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [dataSourceForm, setDataSourceForm] = useState<Omit<DataSource, 'id'>>(createEmptyDataSource(''));
  const [savingDataSource, setSavingDataSource] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    timezone: 'America/Mexico_City',
    weekStartsOn: 1 as 0 | 1,
    notifyOnCampaignSuccess: false,
    notifyOnCampaignFailure: true,
    notificationChannel: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace?.id) {
      loadPipelines();
      loadDataSources();
      loadSettings();
    }
  }, [selectedWorkspace?.id]);

  const loadWorkspaces = async () => {
    try {
      const data = await workspaceService.getAll();
      setWorkspaces(data);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const loadPipelines = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setLoading(true);
      const data = await pipelineService.getByWorkspace(selectedWorkspace.id);
      setPipelines(data);
    } catch (error) {
      toast.error('Error al cargar pipelines');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDataSources = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      const data = await dataSourceService.getByWorkspace(selectedWorkspace.id);
      setDataSources(data);
    } catch (error) {
      console.error('Error loading data sources:', error);
    }
  };

  const loadSettings = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      const data = await workspaceSettingsService.getByWorkspace(selectedWorkspace.id);
      setSettings(data);
      if (data) {
        setSettingsForm({
          timezone: data.timezone || 'America/Mexico_City',
          weekStartsOn: data.weekStartsOn ?? 1,
          notifyOnCampaignSuccess: data.notifyOnCampaignSuccess ?? false,
          notifyOnCampaignFailure: data.notifyOnCampaignFailure ?? true,
          notificationChannel: data.notificationChannel || '',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // ==================== PIPELINE HANDLERS ====================

  const openPipelineModal = (pipeline?: Pipeline) => {
    if (pipeline) {
      setEditingPipeline(pipeline);
      setPipelineForm({
        workspaceId: pipeline.workspaceId,
        name: pipeline.name,
        description: pipeline.description,
        hubspotPipelineId: pipeline.hubspotPipelineId,
        icon: pipeline.icon || '💼',
        color: pipeline.color || '#6366f1',
        stages: pipeline.stages,
        countMetric: pipeline.countMetric,
        amountProperty: pipeline.amountProperty,
        isActive: pipeline.isActive,
        createdAt: pipeline.createdAt,
        updatedAt: Timestamp.now(),
      });
    } else {
      setEditingPipeline(null);
      setPipelineForm(createEmptyPipeline(selectedWorkspace?.id || ''));
    }
    setIsPipelineModalOpen(true);
  };

  const closePipelineModal = () => {
    setIsPipelineModalOpen(false);
    setEditingPipeline(null);
  };

  const savePipeline = async () => {
    if (!pipelineForm.name || !pipelineForm.hubspotPipelineId) {
      toast.error('Nombre y Pipeline ID son requeridos');
      return;
    }
    try {
      setSavingPipeline(true);
      if (editingPipeline) {
        await pipelineService.update(editingPipeline.id, {
          ...pipelineForm,
          updatedAt: Timestamp.now(),
        });
        toast.success('Pipeline actualizado');
      } else {
        await pipelineService.create({
          ...pipelineForm,
          workspaceId: selectedWorkspace?.id || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Pipeline creado');
      }
      closePipelineModal();
      loadPipelines();
    } catch (error) {
      toast.error('Error al guardar pipeline');
      console.error(error);
    } finally {
      setSavingPipeline(false);
    }
  };

  const deletePipeline = async (pipelineId: string) => {
    if (!confirm('¿Estás seguro de eliminar este pipeline?')) return;
    try {
      await pipelineService.delete(pipelineId);
      toast.success('Pipeline eliminado');
      loadPipelines();
    } catch (error) {
      toast.error('Error al eliminar');
      console.error(error);
    }
  };

  const addStage = () => {
    setPipelineForm((prev) => ({
      ...prev,
      stages: [...prev.stages, createEmptyStage(prev.stages.length)],
    }));
  };

  const removeStage = (index: number) => {
    setPipelineForm((prev) => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index),
    }));
  };

  const updateStage = (index: number, updates: Partial<PipelineStage>) => {
    setPipelineForm((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, i) =>
        i === index ? { ...stage, ...updates } : stage
      ),
    }));
  };

  // ==================== DATA SOURCE HANDLERS ====================

  const openDataSourceModal = (ds?: DataSource) => {
    if (ds) {
      setEditingDataSource(ds);
      setDataSourceForm({
        workspaceId: ds.workspaceId,
        name: ds.name,
        description: ds.description,
        type: ds.type,
        icon: ds.icon || '📊',
        pipelineId: ds.pipelineId,
        stageCategories: ds.stageCategories,
        hubspotProperties: ds.hubspotProperties,
        sheetId: ds.sheetId,
        sheetRange: ds.sheetRange,
        apiEndpoint: ds.apiEndpoint,
        apiHeaders: ds.apiHeaders,
        dateRange: ds.dateRange,
        variables: ds.variables,
        isActive: ds.isActive,
        createdAt: ds.createdAt,
        updatedAt: Timestamp.now(),
      });
    } else {
      setEditingDataSource(null);
      setDataSourceForm(createEmptyDataSource(selectedWorkspace?.id || ''));
    }
    setIsDataSourceModalOpen(true);
  };

  const closeDataSourceModal = () => {
    setIsDataSourceModalOpen(false);
    setEditingDataSource(null);
  };

  const saveDataSource = async () => {
    if (!dataSourceForm.name) {
      toast.error('El nombre es requerido');
      return;
    }
    try {
      setSavingDataSource(true);
      if (editingDataSource) {
        await dataSourceService.update(editingDataSource.id, {
          ...dataSourceForm,
          updatedAt: Timestamp.now(),
        });
        toast.success('Fuente de datos actualizada');
      } else {
        await dataSourceService.create({
          ...dataSourceForm,
          workspaceId: selectedWorkspace?.id || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Fuente de datos creada');
      }
      closeDataSourceModal();
      loadDataSources();
    } catch (error) {
      toast.error('Error al guardar');
      console.error(error);
    } finally {
      setSavingDataSource(false);
    }
  };

  const deleteDataSource = async (dsId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta fuente de datos?')) return;
    try {
      await dataSourceService.delete(dsId);
      toast.success('Fuente de datos eliminada');
      loadDataSources();
    } catch (error) {
      toast.error('Error al eliminar');
      console.error(error);
    }
  };

  const addVariable = () => {
    setDataSourceForm((prev) => ({
      ...prev,
      variables: [...prev.variables, createEmptyVariable()],
    }));
  };

  const removeVariable = (index: number) => {
    setDataSourceForm((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }));
  };

  const updateVariable = (index: number, updates: Partial<DataSourceVariable>) => {
    setDataSourceForm((prev) => ({
      ...prev,
      variables: prev.variables.map((v, i) =>
        i === index ? { ...v, ...updates } : v
      ),
    }));
  };

  // ==================== SETTINGS HANDLERS ====================

  const saveSettings = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setSavingSettings(true);
      await workspaceSettingsService.upsert(selectedWorkspace.id, {
        workspaceId: selectedWorkspace.id,
        timezone: settingsForm.timezone,
        weekStartsOn: settingsForm.weekStartsOn,
        notifyOnCampaignSuccess: settingsForm.notifyOnCampaignSuccess,
        notifyOnCampaignFailure: settingsForm.notifyOnCampaignFailure,
        notificationChannel: settingsForm.notificationChannel || undefined,
        updatedAt: Timestamp.now(),
      });
      toast.success('Configuración guardada');
      loadSettings();
    } catch (error) {
      toast.error('Error al guardar');
      console.error(error);
    } finally {
      setSavingSettings(false);
    }
  };

  const currentWorkspace = workspaces.find((w) => w.id === selectedWorkspace?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
        <p className="mt-2 text-gray-600">
          Configura pipelines, fuentes de datos y preferencias del sistema
        </p>
      </div>

      {/* Workspace indicator */}
      {currentWorkspace && (
        <div className="bg-gradient-to-r from-slack-purple/10 to-transparent rounded-lg px-4 py-3 flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-slack-purple" />
          <span className="text-sm text-gray-700">
            Configurando: <strong>{currentWorkspace.name}</strong>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-slack-purple text-slack-purple'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* ==================== PIPELINES TAB ==================== */}
        {activeTab === 'pipelines' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pipelines de HubSpot</h2>
                <p className="text-sm text-gray-500">
                  Configura los pipelines que usarás para métricas y reportes
                </p>
              </div>
              <Button onClick={() => openPipelineModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Pipeline
              </Button>
            </div>

            {/* Empty state */}
            {pipelines.length === 0 && !loading && (
              <Card className="p-12 text-center">
                <GitBranch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Sin pipelines configurados
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Agrega los pipelines de HubSpot que usarás para medir métricas de tus equipos.
                  Puedes tener múltiples pipelines para diferentes productos, canales o áreas.
                </p>
                <Button onClick={() => openPipelineModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar primer pipeline
                </Button>
              </Card>
            )}

            {/* Pipelines grid */}
            {pipelines.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pipelines.map((pipeline) => (
                  <Card
                    key={pipeline.id}
                    className="p-5 hover:shadow-lg transition-shadow cursor-pointer relative overflow-hidden"
                    onClick={() => openPipelineModal(pipeline)}
                  >
                    {/* Color bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: pipeline.color }}
                    />

                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{pipeline.icon}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{pipeline.name}</h3>
                          <p className="text-xs text-gray-500 font-mono">
                            {pipeline.hubspotPipelineId}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePipeline(pipeline.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {pipeline.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {pipeline.description}
                      </p>
                    )}

                    {/* Stages preview */}
                    <div className="mt-4 flex items-center space-x-1">
                      {pipeline.stages.slice(0, 5).map((stage) => {
                        const cat = STAGE_CATEGORIES.find((c) => c.value === stage.category);
                        return (
                          <div
                            key={stage.id}
                            className={`w-2 h-2 rounded-full ${cat?.color || 'bg-gray-300'}`}
                            title={stage.name}
                          />
                        );
                      })}
                      {pipeline.stages.length > 5 && (
                        <span className="text-xs text-gray-400">
                          +{pipeline.stages.length - 5}
                        </span>
                      )}
                      {pipeline.stages.length === 0 && (
                        <span className="text-xs text-gray-400">Sin etapas configuradas</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== DATA SOURCES TAB ==================== */}
        {activeTab === 'datasources' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Fuentes de Datos</h2>
                <p className="text-sm text-gray-500">
                  Configura de dónde se obtienen los datos para tus campañas
                </p>
              </div>
              <Button onClick={() => openDataSourceModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Fuente
              </Button>
            </div>

            {/* Info card */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800">¿Qué son las fuentes de datos?</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Las fuentes de datos definen de dónde se obtiene la información para tus campañas.
                    Cada fuente exporta variables que puedes usar en tus mensajes como{' '}
                    <code className="bg-blue-100 px-1 rounded">{'{{variable}}'}</code>.
                  </p>
                </div>
              </div>
            </Card>

            {/* Empty state */}
            {dataSources.length === 0 && (
              <Card className="p-12 text-center">
                <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Sin fuentes de datos
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Crea fuentes de datos para usar métricas de pipelines, propiedades de HubSpot,
                  Google Sheets u otras fuentes en tus campañas.
                </p>
                <Button onClick={() => openDataSourceModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primera fuente
                </Button>
              </Card>
            )}

            {/* Data sources list */}
            {dataSources.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {dataSources.map((ds) => {
                  const typeInfo = DATA_SOURCE_TYPES.find((t) => t.value === ds.type);
                  const linkedPipeline = pipelines.find((p) => p.id === ds.pipelineId);
                  return (
                    <Card
                      key={ds.id}
                      className="p-5 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => openDataSourceModal(ds)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            {typeInfo && <typeInfo.icon className="w-5 h-5 text-gray-600" />}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{ds.name}</h3>
                            <p className="text-xs text-gray-500">{typeInfo?.label}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDataSource(ds.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {ds.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{ds.description}</p>
                      )}

                      {/* Pipeline link */}
                      {linkedPipeline && (
                        <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500">
                          <GitBranch className="w-3 h-3" />
                          <span>{linkedPipeline.name}</span>
                        </div>
                      )}

                      {/* Variables */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {ds.variables.slice(0, 4).map((v) => (
                          <span
                            key={v.key}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono"
                          >
                            {`{{${v.key}}}`}
                          </span>
                        ))}
                        {ds.variables.length > 4 && (
                          <span className="text-xs text-gray-400">
                            +{ds.variables.length - 4} más
                          </span>
                        )}
                        {ds.variables.length === 0 && (
                          <span className="text-xs text-gray-400">Sin variables definidas</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== GENERAL TAB ==================== */}
        {activeTab === 'general' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Preferencias Generales</h2>
            <div className="space-y-6 max-w-xl">
              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zona horaria
                </label>
                <select
                  value={settingsForm.timezone}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Se usa para programar campañas y mostrar fechas/horas
                </p>
              </div>

              {/* Week starts on */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  La semana inicia en
                </label>
                <div className="flex space-x-4">
                  {[
                    { value: 0, label: 'Domingo' },
                    { value: 1, label: 'Lunes' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="weekStartsOn"
                        value={opt.value}
                        checked={settingsForm.weekStartsOn === opt.value}
                        onChange={() =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            weekStartsOn: opt.value as 0 | 1,
                          }))
                        }
                        className="text-slack-purple focus:ring-slack-purple"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Afecta cómo se calculan las métricas semanales
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Guardando...' : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Preferencias
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ==================== NOTIFICATIONS TAB ==================== */}
        {activeTab === 'notifications' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Notificaciones</h2>
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Alertas de campañas</h3>
                <div className="space-y-3">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.notifyOnCampaignSuccess}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          notifyOnCampaignSuccess: e.target.checked,
                        }))
                      }
                      className="mt-1 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                    />
                    <div>
                      <span className="text-sm text-gray-700 font-medium">
                        Campaña ejecutada exitosamente
                      </span>
                      <p className="text-xs text-gray-500">
                        Recibe una notificación cuando todos los mensajes se envíen correctamente
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.notifyOnCampaignFailure}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          notifyOnCampaignFailure: e.target.checked,
                        }))
                      }
                      className="mt-1 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                    />
                    <div>
                      <span className="text-sm text-gray-700 font-medium">
                        Error en campaña
                      </span>
                      <p className="text-xs text-gray-500">
                        Recibe una alerta si hay problemas al ejecutar una campaña
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canal de notificaciones (Slack)
                </label>
                <input
                  type="text"
                  value={settingsForm.notificationChannel}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, notificationChannel: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="#canal-notificaciones"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nombre del canal donde se enviarán las alertas del sistema
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Guardando...' : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Notificaciones
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ==================== PIPELINE MODAL ==================== */}
      {isPipelineModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPipeline ? 'Editar Pipeline' : 'Nuevo Pipeline'}
                </h2>
                <button onClick={closePipelineModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del pipeline *
                  </label>
                  <input
                    type="text"
                    value={pipelineForm.name}
                    onChange={(e) => setPipelineForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    placeholder="Ej: Ventas Kioscos"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HubSpot Pipeline ID *
                  </label>
                  <input
                    type="text"
                    value={pipelineForm.hubspotPipelineId}
                    onChange={(e) =>
                      setPipelineForm((prev) => ({ ...prev, hubspotPipelineId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                    placeholder="default"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={pipelineForm.description || ''}
                  onChange={(e) =>
                    setPipelineForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Describe para qué se usa este pipeline"
                />
              </div>

              {/* Icon and color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Icono</label>
                  <div className="flex flex-wrap gap-2">
                    {PIPELINE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setPipelineForm((prev) => ({ ...prev, icon }))}
                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg transition-colors ${
                          pipelineForm.icon === icon
                            ? 'border-slack-purple bg-slack-purple/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {PIPELINE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setPipelineForm((prev) => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          pipelineForm.color === color
                            ? 'border-gray-900 scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Stages */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Etapas del pipeline
                  </label>
                  <button
                    type="button"
                    onClick={addStage}
                    className="text-sm text-slack-purple hover:text-slack-purple/80"
                  >
                    + Agregar etapa
                  </button>
                </div>

                {pipelineForm.stages.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Agrega las etapas de tu pipeline y clasifícalas
                    </p>
                    <button
                      type="button"
                      onClick={addStage}
                      className="mt-2 text-sm text-slack-purple hover:underline"
                    >
                      + Agregar primera etapa
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {pipelineForm.stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      <input
                        type="text"
                        value={stage.name}
                        onChange={(e) => updateStage(index, { name: e.target.value })}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="Nombre de la etapa"
                      />
                      <input
                        type="text"
                        value={stage.id}
                        onChange={(e) => updateStage(index, { id: e.target.value })}
                        className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="stage_id"
                      />
                      <select
                        value={stage.category}
                        onChange={(e) =>
                          updateStage(index, { category: e.target.value as StageCategory })
                        }
                        className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      >
                        {STAGE_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeStage(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Category legend */}
                <div className="mt-4 flex flex-wrap gap-3">
                  {STAGE_CATEGORIES.map((cat) => (
                    <div key={cat.value} className="flex items-center space-x-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                      <span className="text-xs text-gray-500">{cat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
              <Button variant="ghost" onClick={closePipelineModal}>
                Cancelar
              </Button>
              <Button onClick={savePipeline} disabled={savingPipeline}>
                {savingPipeline ? 'Guardando...' : editingPipeline ? 'Actualizar' : 'Crear Pipeline'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DATA SOURCE MODAL ==================== */}
      {isDataSourceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingDataSource ? 'Editar Fuente de Datos' : 'Nueva Fuente de Datos'}
                </h2>
                <button onClick={closeDataSourceModal} className="text-gray-400 hover:text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Name and description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la fuente *
                </label>
                <input
                  type="text"
                  value={dataSourceForm.name}
                  onChange={(e) =>
                    setDataSourceForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Ej: Métricas Semanales Kioscos"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={dataSourceForm.description || ''}
                  onChange={(e) =>
                    setDataSourceForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Describe qué datos proporciona esta fuente"
                />
              </div>

              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de fuente
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {DATA_SOURCE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setDataSourceForm((prev) => ({ ...prev, type: type.value }))
                      }
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 text-left transition-colors ${
                        dataSourceForm.type === type.value
                          ? 'border-slack-purple bg-slack-purple/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <type.icon className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-sm text-gray-900">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-specific configuration */}
              {dataSourceForm.type === 'pipeline' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pipeline
                    </label>
                    <select
                      value={dataSourceForm.pipelineId || ''}
                      onChange={(e) =>
                        setDataSourceForm((prev) => ({ ...prev, pipelineId: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    >
                      <option value="">Seleccionar pipeline...</option>
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.icon} {p.name}
                        </option>
                      ))}
                    </select>
                    {pipelines.length === 0 && (
                      <p className="mt-1 text-xs text-yellow-600">
                        Primero configura un pipeline en la pestaña de Pipelines
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categorías de etapas a incluir
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {STAGE_CATEGORIES.filter((c) => c.value !== 'lost').map((cat) => {
                        const isSelected = dataSourceForm.stageCategories?.includes(cat.value);
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              const current = dataSourceForm.stageCategories || [];
                              const updated = isSelected
                                ? current.filter((c) => c !== cat.value)
                                : [...current, cat.value];
                              setDataSourceForm((prev) => ({
                                ...prev,
                                stageCategories: updated,
                              }));
                            }}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                              isSelected
                                ? 'bg-slack-purple text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Date range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rango de fechas
                </label>
                <select
                  value={dataSourceForm.dateRange}
                  onChange={(e) =>
                    setDataSourceForm((prev) => ({
                      ...prev,
                      dateRange: e.target.value as DateRangeType,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                >
                  {DATE_RANGES.map((dr) => (
                    <option key={dr.value} value={dr.value}>
                      {dr.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variables */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Variables que exporta
                  </label>
                  <button
                    type="button"
                    onClick={addVariable}
                    className="text-sm text-slack-purple hover:text-slack-purple/80"
                  >
                    + Agregar variable
                  </button>
                </div>

                {dataSourceForm.variables.length === 0 && (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Sparkles className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Define las variables que estarán disponibles en los mensajes
                    </p>
                    <button
                      type="button"
                      onClick={addVariable}
                      className="mt-2 text-sm text-slack-purple hover:underline"
                    >
                      + Agregar variable
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {dataSourceForm.variables.map((variable, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="text"
                        value={variable.key}
                        onChange={(e) => updateVariable(index, { key: e.target.value })}
                        className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="clave"
                      />
                      <input
                        type="text"
                        value={variable.label}
                        onChange={(e) => updateVariable(index, { label: e.target.value })}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="Etiqueta para mostrar"
                      />
                      <select
                        value={variable.type}
                        onChange={(e) =>
                          updateVariable(index, {
                            type: e.target.value as DataSourceVariable['type'],
                          })
                        }
                        className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      >
                        <option value="number">Número</option>
                        <option value="currency">Moneda</option>
                        <option value="percentage">Porcentaje</option>
                        <option value="text">Texto</option>
                        <option value="date">Fecha</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeVariable(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {dataSourceForm.variables.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700">
                      <strong>Uso en mensajes:</strong>{' '}
                      {dataSourceForm.variables
                        .filter((v) => v.key)
                        .map((v) => `{{${v.key}}}`)
                        .join(', ') || 'Define claves para ver el preview'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
              <Button variant="ghost" onClick={closeDataSourceModal}>
                Cancelar
              </Button>
              <Button onClick={saveDataSource} disabled={savingDataSource}>
                {savingDataSource
                  ? 'Guardando...'
                  : editingDataSource
                  ? 'Actualizar'
                  : 'Crear Fuente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
