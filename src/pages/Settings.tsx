import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Globe,
  Plug,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronRight,
  Edit2,
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
  customPropertyService,
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
  CustomHubSpotProperty,
} from '@/types';

type Tab = 'pipelines' | 'properties' | 'integrations' | 'general' | 'notifications';

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch, description: 'Configura tus pipelines de HubSpot' },
  { id: 'properties', label: 'Propiedades', icon: Layers, description: 'Propiedades custom de HubSpot' },
  { id: 'integrations', label: 'Integraciones', icon: Plug, description: 'OpenAI y Slack' },
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
  amountProperty: '',
  realSalesProperty: '',
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
  const navigate = useNavigate();
  const { selectedWorkspace } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('pipelines');
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [_dataSources, setDataSources] = useState<DataSource[]>([]);
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

  // Custom properties state
  const [customProperties, setCustomProperties] = useState<CustomHubSpotProperty[]>([]);
  const [isPropModalOpen, setIsPropModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<CustomHubSpotProperty | null>(null);
  const [savingProp, setSavingProp] = useState(false);
  const [propForm, setPropForm] = useState<Omit<CustomHubSpotProperty, 'id'>>({
    workspaceId: '',
    name: '',
    label: '',
    category: 'deal',
    type: 'string',
    enumOptions: [],
    description: '',
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    timezone: 'America/Mexico_City',
    weekStartsOn: 1 as 0 | 1,
    notifyOnCampaignSuccess: false,
    notifyOnCampaignFailure: true,
    notificationChannel: '',
    openaiApiKey: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace?.id) {
      loadPipelines();
      loadDataSources();
      loadSettings();
      customPropertyService.getByWorkspace(selectedWorkspace.id).then(setCustomProperties).catch(console.error);
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
          openaiApiKey: data.openaiApiKey || '',
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
        realSalesProperty: pipeline.realSalesProperty,
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

  // ==================== CUSTOM PROPERTY HANDLERS ====================

  const openPropModal = (prop?: CustomHubSpotProperty) => {
    if (prop) {
      setEditingProp(prop);
      setPropForm({ ...prop, updatedAt: Timestamp.now() });
    } else {
      setEditingProp(null);
      setPropForm({
        workspaceId: selectedWorkspace?.id || '',
        name: '',
        label: '',
        category: 'deal',
        type: 'string',
        enumOptions: [],
        description: '',
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    setIsPropModalOpen(true);
  };

  const closePropModal = () => {
    setIsPropModalOpen(false);
    setEditingProp(null);
  };

  const saveProp = async () => {
    if (!propForm.name.trim() || !propForm.label.trim()) {
      toast.error('Nombre y etiqueta son requeridos');
      return;
    }
    setSavingProp(true);
    try {
      if (editingProp) {
        await customPropertyService.update(editingProp.id, { ...propForm, updatedAt: Timestamp.now() });
        toast.success('Propiedad actualizada');
      } else {
        await customPropertyService.create({
          ...propForm,
          workspaceId: selectedWorkspace?.id || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Propiedad creada');
      }
      closePropModal();
      customPropertyService.getByWorkspace(selectedWorkspace?.id || '').then(setCustomProperties);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSavingProp(false);
    }
  };

  const deleteProp = async (propId: string) => {
    if (!confirm('¿Eliminar esta propiedad?')) return;
    try {
      await customPropertyService.delete(propId);
      toast.success('Propiedad eliminada');
      customPropertyService.getByWorkspace(selectedWorkspace?.id || '').then(setCustomProperties);
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const addEnumOption = (value: string, label: string) => {
    const trimmedValue = value.trim();
    const trimmedLabel = label.trim();
    if (!trimmedValue || !trimmedLabel) return;
    if ((propForm.enumOptions || []).some((o: any) => o.value === trimmedValue)) return;
    setPropForm(p => ({ ...p, enumOptions: [...(p.enumOptions || []), { value: trimmedValue, label: trimmedLabel }] }));
  };

  const removeEnumOption = (value: string) => {
    setPropForm(p => ({ ...p, enumOptions: (p.enumOptions || []).filter((o: any) => o.value !== value) }));
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
        notificationChannel: settingsForm.notificationChannel || '',
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

  const saveIntegrations = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setSavingIntegrations(true);
      await workspaceSettingsService.upsert(selectedWorkspace.id, {
        workspaceId: selectedWorkspace.id,
        openaiApiKey: settingsForm.openaiApiKey || '',
        updatedAt: Timestamp.now(),
      });
      toast.success('Integraciones guardadas');
      loadSettings();
    } catch (error) {
      toast.error('Error al guardar integraciones');
      console.error(error);
    } finally {
      setSavingIntegrations(false);
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

        {/* ==================== PROPERTIES TAB ==================== */}
        {activeTab === 'properties' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Propiedades de HubSpot</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Registra las propiedades custom de tu cuenta de HubSpot. Se usan como filtros en las fuentes de datos y como variables en los mensajes.
                </p>
              </div>
              <Button onClick={() => openPropModal()} className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Nueva Propiedad</span>
              </Button>
            </div>

            {customProperties.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Sin propiedades registradas</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                  Agrega las propiedades custom de HubSpot que usas para filtrar deals (ej: producto, canal, fuente).
                </p>
                <button onClick={() => openPropModal()} className="mt-4 text-sm text-slack-purple hover:underline">
                  + Agregar primera propiedad
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Propiedad</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre en HubSpot</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valores válidos</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customProperties.map((prop) => (
                      <tr key={prop.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{prop.label}</div>
                          {prop.description && <div className="text-xs text-gray-400 mt-0.5">{prop.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <code className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{prop.name}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            prop.type === 'enum' ? 'bg-purple-100 text-purple-700' :
                            prop.type === 'number' ? 'bg-blue-100 text-blue-700' :
                            prop.type === 'date' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {prop.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {prop.type === 'enum' && prop.enumOptions?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {(prop.enumOptions as any[]).map((opt: any) => (
                                <span key={typeof opt === 'string' ? opt : opt.value}
                                  className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                                  {typeof opt === 'string' ? opt : opt.label}
                                  {typeof opt !== 'string' && (
                                    <span className="text-purple-400 ml-1 font-mono text-xs">({opt.value})</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1 justify-end">
                            <button onClick={() => openPropModal(prop)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteProp(prop.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============== Fuentes de Datos — banner de acceso rápido ============== */}
        {activeTab === 'pipelines' && (
          <button
            onClick={() => navigate('/data-sources')}
            className="w-full flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-200 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-700" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-blue-800">Fuentes de Datos</p>
                <p className="text-xs text-blue-600">
                  Gestiona las métricas y variables que alimentan tus campañas
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-500" />
          </button>
        )}

        {/* ==================== INTEGRATIONS TAB ==================== */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            {/* OpenAI */}
            <Card className="p-6">
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">OpenAI</h2>
                  <p className="text-sm text-gray-500">
                    Genera y reescribe mensajes automaticamente con IA. Se usa en campanas con la opcion de IA habilitada.
                  </p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  {settingsForm.openaiApiKey ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Configurado
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      No configurado
                    </span>
                  )}
                </div>
              </div>

              <div className="max-w-xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key de OpenAI
                </label>
                <div className="relative">
                  <input
                    type={showOpenAIKey ? 'text' : 'password'}
                    value={settingsForm.openaiApiKey}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))
                    }
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={showOpenAIKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Modelo utilizado: <code className="bg-gray-100 px-1 py-0.5 rounded">gpt-4o-mini</code>. La clave se almacena de forma segura en Firestore.
                </p>
              </div>
            </Card>

            {/* Slack Interactivity */}
            <Card className="p-6">
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Slack Interactividad</h2>
                  <p className="text-sm text-gray-500">
                    Permite que los botones en mensajes de Slack (feedback, tips, progreso) funcionen correctamente.
                  </p>
                </div>
              </div>

              <div className="max-w-xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de Interactividad (Request URL)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={`https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID || '<project-id>'}.cloudfunctions.net/handleSlackInteraction`}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID || ''}.cloudfunctions.net/handleSlackInteraction`;
                      navigator.clipboard.writeText(url);
                      toast.success('URL copiada');
                    }}
                    className="p-2 text-gray-400 hover:text-slack-purple hover:bg-purple-50 rounded-lg"
                    title="Copiar URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Configuracion en Slack:</strong> Ve a tu app en <code>api.slack.com</code> &rarr;
                    <em> Interactivity &amp; Shortcuts</em> &rarr; activa <em>Interactivity</em> y pega esta URL en
                    <em> Request URL</em>.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveIntegrations} disabled={savingIntegrations}>
                {savingIntegrations ? 'Guardando...' : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Integraciones
                  </>
                )}
              </Button>
            </div>
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
                        className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="ID en HubSpot"
                        title="ID de la etapa en HubSpot (ej: 33823866)"
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

              {/* HubSpot Properties */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Propiedades de HubSpot
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Campos específicos de tu cuenta de HubSpot que el sistema usa para calcular métricas.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Propiedad de ventas reales
                  </label>
                  <input
                    type="text"
                    value={pipelineForm.realSalesProperty || ''}
                    onChange={(e) =>
                      setPipelineForm((prev) => ({ ...prev, realSalesProperty: e.target.value || undefined }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                    placeholder="hs_v2_date_entered_XXXXXXXX"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    La propiedad <code className="bg-gray-100 px-1 rounded">hs_v2_date_entered_*</code> que indica que un deal fue desembolsado o cerrado como venta real. Si se deja vacío, usa <code className="bg-gray-100 px-1 rounded">hs_v2_date_entered_33823866</code> por defecto.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Propiedad de monto
                  </label>
                  <input
                    type="text"
                    value={pipelineForm.amountProperty || ''}
                    onChange={(e) =>
                      setPipelineForm((prev) => ({ ...prev, amountProperty: e.target.value || undefined }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                    placeholder="amount"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    La propiedad de HubSpot que contiene el monto del deal. Por defecto: <code className="bg-gray-100 px-1 rounded">amount</code>.
                  </p>
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

      {/* ============================================================ */}
      {/* PROPERTY MODAL                                                */}
      {/* ============================================================ */}
      {isPropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProp ? 'Editar propiedad' : 'Nueva propiedad'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Propiedad custom de HubSpot</p>
              </div>
              <button onClick={closePropModal} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etiqueta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propForm.label}
                  onChange={(e) => setPropForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="Ej: Producto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Nombre que verás en la app</p>
              </div>

              {/* HubSpot internal name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre en HubSpot <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propForm.name}
                  onChange={(e) => setPropForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="Ej: producto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  El nombre interno de la propiedad en HubSpot (sin espacios, minúsculas)
                </p>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de dato</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'string', label: 'Texto', desc: 'Valores de texto libre' },
                    { value: 'number', label: 'Número', desc: 'Valores numéricos' },
                    { value: 'date', label: 'Fecha', desc: 'Fechas y timestamps' },
                    { value: 'boolean', label: 'Sí / No', desc: 'Verdadero o falso' },
                    { value: 'enum', label: 'Lista de opciones', desc: 'Valores predefinidos' },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPropForm(p => ({ ...p, type: t.value, enumOptions: t.value === 'enum' ? (p.enumOptions || []) : [] }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        propForm.type === t.value ? 'border-slack-purple bg-slack-purple/5' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{t.label}</div>
                      <div className="text-xs text-gray-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Enum options */}
              {propForm.type === 'enum' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valores válidos
                  </label>
                  <div className="space-y-2">
                    {/* Add new option row */}
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <input
                          id="enum-value-input"
                          type="text"
                          placeholder="Valor interno (ej: credito_personal)"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slack-purple"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          id="enum-label-input"
                          type="text"
                          placeholder="Etiqueta (ej: Crédito Personal)"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const valueInput = document.getElementById('enum-value-input') as HTMLInputElement;
                              const labelInput = e.target as HTMLInputElement;
                              addEnumOption(valueInput.value, labelInput.value);
                              valueInput.value = '';
                              labelInput.value = '';
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const valueInput = document.getElementById('enum-value-input') as HTMLInputElement;
                          const labelInput = document.getElementById('enum-label-input') as HTMLInputElement;
                          addEnumOption(valueInput.value, labelInput.value);
                          valueInput.value = '';
                          labelInput.value = '';
                        }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 whitespace-nowrap"
                      >
                        + Agregar
                      </button>
                    </div>

                    <div className="text-xs text-gray-400 flex items-start space-x-4 px-1">
                      <span className="font-mono">valor_interno</span>
                      <span>→ etiqueta visible</span>
                    </div>

                    {/* Options list */}
                    {(propForm.enumOptions || []).length > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Valor interno</th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Etiqueta</th>
                              <th className="px-2 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(propForm.enumOptions as any[] || []).map((opt: any) => (
                              <tr key={opt.value}>
                                <td className="px-3 py-2">
                                  <code className="text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{opt.value}</code>
                                </td>
                                <td className="px-3 py-2 text-gray-800">{opt.label}</td>
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => removeEnumOption(opt.value)}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <p className="text-xs text-gray-400">
                      El <strong>valor interno</strong> se usa en los filtros de HubSpot. La <strong>etiqueta</strong> aparece en los mensajes como variable.
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={propForm.description || ''}
                  onChange={(e) => setPropForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="¿Para qué se usa esta propiedad?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button variant="ghost" onClick={closePropModal}>Cancelar</Button>
              <Button onClick={saveProp} disabled={savingProp}>
                {savingProp ? 'Guardando…' : editingProp ? 'Actualizar' : 'Crear propiedad'}
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
