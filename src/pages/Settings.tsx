import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Bell,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Building2,
  User,
  Briefcase,
  Tag,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import {
  workspaceService,
  hubspotPropertyService,
  workspaceSettingsService,
} from '@/services/firestore';
import type {
  SlackWorkspace,
  CustomHubSpotProperty,
  WorkspaceSettings,
} from '@/types';

type Tab = 'general' | 'hubspot' | 'notifications';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'hubspot', label: 'Propiedades HubSpot', icon: Database },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
];

const PROPERTY_CATEGORIES = [
  { value: 'deal', label: 'Negocio', icon: Briefcase },
  { value: 'contact', label: 'Contacto', icon: User },
  { value: 'company', label: 'Empresa', icon: Building2 },
  { value: 'custom', label: 'Personalizado', icon: Tag },
] as const;

const PROPERTY_TYPES = [
  { value: 'string', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'enum', label: 'Lista de opciones' },
] as const;

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Monterrey', label: 'Monterrey (GMT-6)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
];

// Default empty property for the form
const createEmptyProperty = (workspaceId: string): Omit<CustomHubSpotProperty, 'id'> => ({
  workspaceId,
  name: '',
  label: '',
  category: 'deal',
  type: 'string',
  isActive: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

export function Settings() {
  const { selectedWorkspace } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [properties, setProperties] = useState<CustomHubSpotProperty[]>([]);
  const [_settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Property form state
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<CustomHubSpotProperty | null>(null);
  const [propertyForm, setPropertyForm] = useState<Omit<CustomHubSpotProperty, 'id'>>(
    createEmptyProperty('')
  );
  const [savingProperty, setSavingProperty] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    timezone: 'America/Mexico_City',
    weekStartsOn: 1 as 0 | 1,
    defaultPipeline: '',
    advancedDealStages: '',
    closedDealStages: '',
    notifyOnCampaignSuccess: false,
    notifyOnCampaignFailure: true,
    notificationChannel: '',
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadProperties();
      loadSettings();
    }
  }, [selectedWorkspace]);

  const loadWorkspaces = async () => {
    try {
      const data = await workspaceService.getAll();
      setWorkspaces(data);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const loadProperties = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setLoading(true);
      const data = await hubspotPropertyService.getByWorkspace(selectedWorkspace.id);
      setProperties(data);
    } catch (error) {
      toast.error('Error al cargar propiedades');
      console.error(error);
    } finally {
      setLoading(false);
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
          defaultPipeline: data.defaultPipeline || '',
          advancedDealStages: data.advancedDealStages?.join(', ') || '',
          closedDealStages: data.closedDealStages?.join(', ') || '',
          notifyOnCampaignSuccess: data.notifyOnCampaignSuccess ?? false,
          notifyOnCampaignFailure: data.notifyOnCampaignFailure ?? true,
          notificationChannel: data.notificationChannel || '',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setSavingSettings(true);
      await workspaceSettingsService.upsert(selectedWorkspace.id, {
        workspaceId: selectedWorkspace.id,
        timezone: settingsForm.timezone,
        weekStartsOn: settingsForm.weekStartsOn,
        defaultPipeline: settingsForm.defaultPipeline || undefined,
        advancedDealStages: settingsForm.advancedDealStages
          ? settingsForm.advancedDealStages.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        closedDealStages: settingsForm.closedDealStages
          ? settingsForm.closedDealStages.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        notifyOnCampaignSuccess: settingsForm.notifyOnCampaignSuccess,
        notifyOnCampaignFailure: settingsForm.notifyOnCampaignFailure,
        notificationChannel: settingsForm.notificationChannel || undefined,
        updatedAt: Timestamp.now(),
      });
      toast.success('Configuración guardada');
      loadSettings();
    } catch (error) {
      toast.error('Error al guardar configuración');
      console.error(error);
    } finally {
      setSavingSettings(false);
    }
  };

  const openPropertyModal = (property?: CustomHubSpotProperty) => {
    if (property) {
      setEditingProperty(property);
      setPropertyForm({
        workspaceId: property.workspaceId,
        name: property.name,
        label: property.label,
        category: property.category,
        type: property.type,
        enumOptions: property.enumOptions,
        description: property.description,
        isActive: property.isActive,
        createdAt: property.createdAt,
        updatedAt: Timestamp.now(),
      });
    } else {
      setEditingProperty(null);
      setPropertyForm(createEmptyProperty(selectedWorkspace?.id || ''));
    }
    setIsPropertyModalOpen(true);
  };

  const closePropertyModal = () => {
    setIsPropertyModalOpen(false);
    setEditingProperty(null);
    setPropertyForm(createEmptyProperty(selectedWorkspace?.id || ''));
  };

  const saveProperty = async () => {
    if (!propertyForm.name || !propertyForm.label) {
      toast.error('Nombre y etiqueta son requeridos');
      return;
    }
    try {
      setSavingProperty(true);
      if (editingProperty) {
        await hubspotPropertyService.update(editingProperty.id, {
          ...propertyForm,
          updatedAt: Timestamp.now(),
        });
        toast.success('Propiedad actualizada');
      } else {
        await hubspotPropertyService.create({
          ...propertyForm,
          workspaceId: selectedWorkspace?.id || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Propiedad creada');
      }
      closePropertyModal();
      loadProperties();
    } catch (error) {
      toast.error('Error al guardar propiedad');
      console.error(error);
    } finally {
      setSavingProperty(false);
    }
  };

  const deleteProperty = async (propertyId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta propiedad?')) return;
    try {
      await hubspotPropertyService.delete(propertyId);
      toast.success('Propiedad eliminada');
      loadProperties();
    } catch (error) {
      toast.error('Error al eliminar propiedad');
      console.error(error);
    }
  };

  const currentWorkspace = workspaces.find((w) => w.id === selectedWorkspace?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
        <p className="mt-2 text-gray-600">
          Administra las propiedades de HubSpot y preferencias del workspace
        </p>
      </div>

      {/* Workspace indicator */}
      {currentWorkspace && (
        <div className="bg-slack-purple/5 rounded-lg px-4 py-3 flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-slack-purple" />
          <span className="text-sm text-gray-700">
            Configuración para: <strong>{currentWorkspace.name}</strong>
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
        {/* General Settings Tab */}
        {activeTab === 'general' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Configuración General</h2>
            <div className="space-y-6 max-w-2xl">
              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zona horaria
                </label>
                <select
                  value={settingsForm.timezone}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
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
              </div>

              {/* Default Pipeline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pipeline predeterminado (HubSpot ID)
                </label>
                <input
                  type="text"
                  value={settingsForm.defaultPipeline}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, defaultPipeline: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Ej: default, 12345678"
                />
                <p className="mt-1 text-xs text-gray-500">
                  El ID del pipeline de HubSpot usado por defecto para métricas de ventas
                </p>
              </div>

              {/* Advanced Deal Stages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etapas avanzadas de negocio (IDs separados por coma)
                </label>
                <input
                  type="text"
                  value={settingsForm.advancedDealStages}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, advancedDealStages: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Ej: qualified, proposal, negotiation"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Etapas que cuentan como "ventas avanzadas" para métricas de desempeño
                </p>
              </div>

              {/* Closed Deal Stages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etapas cerradas/ganadas (IDs separados por coma)
                </label>
                <input
                  type="text"
                  value={settingsForm.closedDealStages}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, closedDealStages: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Ej: closedwon, 12345678"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Etapas que cuentan como "ventas reales" o cerradas
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? (
                    <>
                      <span className="animate-spin mr-2">...</span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Configuración
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* HubSpot Properties Tab */}
        {activeTab === 'hubspot' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Propiedades de HubSpot</h2>
                <p className="text-sm text-gray-500">
                  Define las propiedades que deseas usar en reglas y automatizaciones
                </p>
              </div>
              <Button onClick={() => openPropertyModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Propiedad
              </Button>
            </div>

            {/* Empty state */}
            {properties.length === 0 && !loading && (
              <Card className="p-12 text-center">
                <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Sin propiedades configuradas
                </h3>
                <p className="text-gray-500 mb-6">
                  Agrega las propiedades de HubSpot que usarás en tus reglas y automatizaciones
                </p>
                <Button onClick={() => openPropertyModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar primera propiedad
                </Button>
              </Card>
            )}

            {/* Properties grid by category */}
            {properties.length > 0 && (
              <div className="space-y-6">
                {PROPERTY_CATEGORIES.map((category) => {
                  const categoryProperties = properties.filter((p) => p.category === category.value);
                  if (categoryProperties.length === 0) return null;

                  return (
                    <div key={category.value}>
                      <div className="flex items-center space-x-2 mb-3">
                        <category.icon className="w-4 h-4 text-gray-500" />
                        <h3 className="font-medium text-gray-700">{category.label}</h3>
                        <span className="text-xs text-gray-400">
                          ({categoryProperties.length})
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {categoryProperties.map((property) => (
                          <Card
                            key={property.id}
                            className="p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {property.label}
                                </h4>
                                <p className="text-xs text-gray-500 font-mono mt-1">
                                  {property.name}
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                    {PROPERTY_TYPES.find((t) => t.value === property.type)?.label}
                                  </span>
                                  {property.enumOptions && property.enumOptions.length > 0 && (
                                    <span className="text-xs text-gray-400">
                                      {property.enumOptions.length} opciones
                                    </span>
                                  )}
                                </div>
                                {property.description && (
                                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                                    {property.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <button
                                  onClick={() => openPropertyModal(property)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteProperty(property.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Preferencias de Notificaciones
            </h2>
            <div className="space-y-6 max-w-2xl">
              {/* Campaign notifications */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Notificaciones de Campañas
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.notifyOnCampaignSuccess}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          notifyOnCampaignSuccess: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                    />
                    <div>
                      <span className="text-sm text-gray-700">Notificar al completar campaña exitosamente</span>
                      <p className="text-xs text-gray-500">
                        Recibe una notificación cuando una campaña se ejecute correctamente
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.notifyOnCampaignFailure}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          notifyOnCampaignFailure: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                    />
                    <div>
                      <span className="text-sm text-gray-700">Notificar cuando una campaña falle</span>
                      <p className="text-xs text-gray-500">
                        Recibe una alerta si hay errores al ejecutar una campaña
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notification channel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canal de notificaciones (Slack Channel ID)
                </label>
                <input
                  type="text"
                  value={settingsForm.notificationChannel}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, notificationChannel: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Ej: C0XXXXXXX"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Canal donde se enviarán las notificaciones del sistema
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? (
                    <>
                      <span className="animate-spin mr-2">...</span>
                      Guardando...
                    </>
                  ) : (
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
      </div>

      {/* Property Modal */}
      {isPropertyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProperty ? 'Editar Propiedad' : 'Nueva Propiedad'}
                </h2>
                <button
                  onClick={closePropertyModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Name (internal) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre interno (API) *
                </label>
                <input
                  type="text"
                  value={propertyForm.name}
                  onChange={(e) =>
                    setPropertyForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                  placeholder="Ej: hs_deal_stage, custom_metric"
                />
                <p className="mt-1 text-xs text-gray-500">
                  El nombre exacto de la propiedad en HubSpot (sensible a mayúsculas)
                </p>
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etiqueta de display *
                </label>
                <input
                  type="text"
                  value={propertyForm.label}
                  onChange={(e) =>
                    setPropertyForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  placeholder="Ej: Etapa del Negocio"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PROPERTY_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() =>
                        setPropertyForm((prev) => ({ ...prev, category: cat.value }))
                      }
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                        propertyForm.category === cat.value
                          ? 'border-slack-purple bg-slack-purple/5 text-slack-purple'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <cat.icon className="w-4 h-4" />
                      <span className="text-sm">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de dato
                </label>
                <select
                  value={propertyForm.type}
                  onChange={(e) =>
                    setPropertyForm((prev) => ({
                      ...prev,
                      type: e.target.value as CustomHubSpotProperty['type'],
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Enum options (if type is enum) */}
              {propertyForm.type === 'enum' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opciones (una por línea)
                  </label>
                  <textarea
                    value={propertyForm.enumOptions?.join('\n') || ''}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({
                        ...prev,
                        enumOptions: e.target.value.split('\n').filter(Boolean),
                      }))
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                    placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={propertyForm.description || ''}
                  onChange={(e) =>
                    setPropertyForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                  placeholder="Describe para qué se usa esta propiedad"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button variant="ghost" onClick={closePropertyModal}>
                Cancelar
              </Button>
              <Button onClick={saveProperty} disabled={savingProperty}>
                {savingProperty ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {editingProperty ? 'Actualizar' : 'Crear'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
