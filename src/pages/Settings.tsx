import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Bell,
  Plus,
  Trash2,
  Save,
  Building2,
  GitBranch,
  HelpCircle,
  Globe,
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Hash,
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
import {
  PipelineModal,
  DataSourceModal,
  STAGE_CATEGORIES,
  DATA_SOURCE_TYPES,
} from '@/components/settings';
import type {
  SlackWorkspace,
  Pipeline,
  DataSource,
} from '@/types';

type Tab = 'pipelines' | 'datasources' | 'general' | 'notifications';

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch, description: 'Configura tus pipelines de HubSpot' },
  { id: 'datasources', label: 'Fuentes de Datos', icon: Database, description: 'Define de dónde obtener información' },
  { id: 'general', label: 'General', icon: SettingsIcon, description: 'Preferencias generales' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, description: 'Alertas y avisos' },
];

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Monterrey', label: 'Monterrey (GMT-6)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-4)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

const CURRENCIES = [
  { value: 'MXN', label: 'Peso Mexicano (MXN)', symbol: '$' },
  { value: 'USD', label: 'Dólar Estadounidense (USD)', symbol: '$' },
  { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { value: 'COP', label: 'Peso Colombiano (COP)', symbol: '$' },
  { value: 'PEN', label: 'Sol Peruano (PEN)', symbol: 'S/' },
  { value: 'CLP', label: 'Peso Chileno (CLP)', symbol: '$' },
  { value: 'ARS', label: 'Peso Argentino (ARS)', symbol: '$' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
  { value: 'D MMM YYYY', label: 'D MMM YYYY (31 Dic 2024)' },
];

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

export function Settings() {
  const { selectedWorkspace } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('pipelines');
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);

  // Pipeline modal state
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);

  // DataSource modal state
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    // General
    timezone: 'America/Mexico_City',
    weekStartsOn: 1 as 0 | 1,
    currency: 'MXN',
    dateFormat: 'DD/MM/YYYY',
    language: 'es',
    // Notifications
    notifyOnCampaignSuccess: false,
    notifyOnCampaignFailure: true,
    notifyOnNewDeal: false,
    notifyOnDealWon: true,
    notifyOnDailySummary: false,
    dailySummaryTime: '09:00',
    notificationChannel: '',
    alertChannel: '',
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
      if (data) {
        setSettingsForm((prev) => ({
          ...prev,
          timezone: data.timezone || 'America/Mexico_City',
          weekStartsOn: data.weekStartsOn ?? 1,
          currency: (data as any).currency || 'MXN',
          dateFormat: (data as any).dateFormat || 'DD/MM/YYYY',
          language: (data as any).language || 'es',
          notifyOnCampaignSuccess: data.notifyOnCampaignSuccess ?? false,
          notifyOnCampaignFailure: data.notifyOnCampaignFailure ?? true,
          notifyOnNewDeal: (data as any).notifyOnNewDeal ?? false,
          notifyOnDealWon: (data as any).notifyOnDealWon ?? true,
          notifyOnDailySummary: (data as any).notifyOnDailySummary ?? false,
          dailySummaryTime: (data as any).dailySummaryTime || '09:00',
          notificationChannel: data.notificationChannel || '',
          alertChannel: (data as any).alertChannel || '',
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // ==================== PIPELINE HANDLERS ====================

  const openPipelineModal = (pipeline?: Pipeline) => {
    setEditingPipeline(pipeline || null);
    setIsPipelineModalOpen(true);
  };

  const closePipelineModal = () => {
    setIsPipelineModalOpen(false);
    setEditingPipeline(null);
  };

  const deletePipeline = async (pipelineId: string) => {
    if (!confirm('¿Estás seguro de eliminar este pipeline? Esta acción no se puede deshacer.')) return;
    try {
      await pipelineService.delete(pipelineId);
      toast.success('Pipeline eliminado');
      loadPipelines();
    } catch (error) {
      toast.error('Error al eliminar');
      console.error(error);
    }
  };

  // ==================== DATA SOURCE HANDLERS ====================

  const openDataSourceModal = (ds?: DataSource) => {
    setEditingDataSource(ds || null);
    setIsDataSourceModalOpen(true);
  };

  const closeDataSourceModal = () => {
    setIsDataSourceModalOpen(false);
    setEditingDataSource(null);
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

  // ==================== SETTINGS HANDLERS ====================

  const saveSettings = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setSavingSettings(true);
      await workspaceSettingsService.upsert(selectedWorkspace.id, {
        workspaceId: selectedWorkspace.id,
        timezone: settingsForm.timezone,
        weekStartsOn: settingsForm.weekStartsOn,
        currency: settingsForm.currency,
        dateFormat: settingsForm.dateFormat,
        language: settingsForm.language,
        notifyOnCampaignSuccess: settingsForm.notifyOnCampaignSuccess,
        notifyOnCampaignFailure: settingsForm.notifyOnCampaignFailure,
        notifyOnNewDeal: settingsForm.notifyOnNewDeal,
        notifyOnDealWon: settingsForm.notifyOnDealWon,
        notifyOnDailySummary: settingsForm.notifyOnDailySummary,
        dailySummaryTime: settingsForm.dailySummaryTime,
        notificationChannel: settingsForm.notificationChannel || undefined,
        alertChannel: settingsForm.alertChannel || undefined,
        updatedAt: Timestamp.now(),
      } as any);
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
                        aria-label="Eliminar pipeline"
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
                          aria-label="Eliminar fuente de datos"
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
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <Globe className="w-5 h-5 text-gray-600" />
                <span>Región y Formato</span>
              </h2>
              <div className="space-y-6 max-w-xl">
                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Zona horaria</span>
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

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span>Idioma</span>
                  </label>
                  <select
                    value={settingsForm.language}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, language: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Formato de fecha</span>
                  </label>
                  <select
                    value={settingsForm.dateFormat}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, dateFormat: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  >
                    {DATE_FORMATS.map((fmt) => (
                      <option key={fmt.value} value={fmt.value}>
                        {fmt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span>Moneda predeterminada</span>
                  </label>
                  <select
                    value={settingsForm.currency}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({ ...prev, currency: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  >
                    {CURRENCIES.map((curr) => (
                      <option key={curr.value} value={curr.value}>
                        {curr.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Se usa para formatear valores monetarios en reportes y mensajes
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
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? (
                  'Guardando...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Preferencias
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ==================== NOTIFICATIONS TAB ==================== */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Campaign notifications */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <Bell className="w-5 h-5 text-gray-600" />
                <span>Alertas de Campañas</span>
              </h2>
              <div className="space-y-4 max-w-xl">
                <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
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
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-700 font-medium">
                        Campaña ejecutada exitosamente
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Recibe una notificación cuando todos los mensajes se envíen correctamente
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
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
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-gray-700 font-medium">
                        Error en campaña
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Recibe una alerta si hay problemas al ejecutar una campaña
                    </p>
                  </div>
                </label>
              </div>
            </Card>

            {/* Deal notifications */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <GitBranch className="w-5 h-5 text-gray-600" />
                <span>Alertas de Negocios</span>
              </h2>
              <div className="space-y-4 max-w-xl">
                <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settingsForm.notifyOnNewDeal}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        notifyOnNewDeal: e.target.checked,
                      }))
                    }
                    className="mt-1 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-700 font-medium">
                      Nuevo negocio creado
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Notificar cuando se crea un nuevo negocio en HubSpot
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settingsForm.notifyOnDealWon}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        notifyOnDealWon: e.target.checked,
                      }))
                    }
                    className="mt-1 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-700 font-medium">
                      Negocio ganado
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Celebrar cuando un negocio se marca como ganado
                    </p>
                  </div>
                </label>
              </div>
            </Card>

            {/* Daily summary */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <span>Resumen Diario</span>
              </h2>
              <div className="space-y-4 max-w-xl">
                <label className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settingsForm.notifyOnDailySummary}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        notifyOnDailySummary: e.target.checked,
                      }))
                    }
                    className="mt-1 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-700 font-medium">
                      Enviar resumen diario
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Recibe un resumen de métricas clave cada día
                    </p>
                  </div>
                </label>

                {settingsForm.notifyOnDailySummary && (
                  <div className="ml-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora del resumen
                    </label>
                    <input
                      type="time"
                      value={settingsForm.dailySummaryTime}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          dailySummaryTime: e.target.value,
                        }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Channels configuration */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <Hash className="w-5 h-5 text-gray-600" />
                <span>Canales de Slack</span>
              </h2>
              <div className="space-y-6 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canal de notificaciones generales
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={settingsForm.notificationChannel}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          notificationChannel: e.target.value.replace(/^#/, ''),
                        }))
                      }
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="general-notifications"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Canal donde se enviarán las notificaciones de éxito y resúmenes
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canal de alertas y errores
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={settingsForm.alertChannel}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          alertChannel: e.target.value.replace(/^#/, ''),
                        }))
                      }
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="alerts"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Canal donde se enviarán las alertas de errores (opcional, si no se especifica usa el canal general)
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? (
                  'Guardando...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Notificaciones
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODALS ==================== */}
      <PipelineModal
        isOpen={isPipelineModalOpen}
        onClose={closePipelineModal}
        pipeline={editingPipeline}
        workspaceId={selectedWorkspace?.id || ''}
        onSaved={loadPipelines}
      />

      <DataSourceModal
        isOpen={isDataSourceModalOpen}
        onClose={closeDataSourceModal}
        dataSource={editingDataSource}
        workspaceId={selectedWorkspace?.id || ''}
        pipelines={pipelines}
        onSaved={loadDataSources}
      />
    </div>
  );
}
