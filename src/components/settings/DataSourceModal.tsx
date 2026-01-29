import { useState, useEffect } from 'react';
import {
  Trash2,
  Sparkles,
  GitBranch,
  Layers,
  FileSpreadsheet,
  Globe,
  AlertCircle,
  Key,
  Plus,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { dataSourceService } from '@/services/firestore';
import { STAGE_CATEGORIES } from './PipelineModal';
import type {
  DataSource,
  DataSourceVariable,
  DataSourceType,
  DateRangeType,
  Pipeline,
  StageCategory,
} from '@/types';

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

const HUBSPOT_OBJECT_TYPES = [
  { value: 'deals', label: 'Negocios (Deals)' },
  { value: 'contacts', label: 'Contactos' },
  { value: 'companies', label: 'Empresas' },
  { value: 'tickets', label: 'Tickets' },
];

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
];

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

const createEmptyVariable = (): DataSourceVariable => ({
  key: '',
  label: '',
  type: 'number',
});

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSource?: DataSource | null;
  workspaceId: string;
  pipelines: Pipeline[];
  onSaved: () => void;
}

export function DataSourceModal({
  isOpen,
  onClose,
  dataSource,
  workspaceId,
  pipelines,
  onSaved,
}: DataSourceModalProps) {
  const [form, setForm] = useState<Omit<DataSource, 'id'>>(createEmptyDataSource(workspaceId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiHeaders, setApiHeaders] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (dataSource) {
        setForm({
          workspaceId: dataSource.workspaceId,
          name: dataSource.name,
          description: dataSource.description,
          type: dataSource.type,
          icon: dataSource.icon || '📊',
          pipelineId: dataSource.pipelineId,
          stageCategories: dataSource.stageCategories,
          hubspotProperties: dataSource.hubspotProperties,
          hubspotObjectType: dataSource.hubspotObjectType,
          sheetId: dataSource.sheetId,
          sheetRange: dataSource.sheetRange,
          apiEndpoint: dataSource.apiEndpoint,
          apiMethod: dataSource.apiMethod,
          apiHeaders: dataSource.apiHeaders,
          dateRange: dataSource.dateRange,
          variables: dataSource.variables,
          isActive: dataSource.isActive,
          createdAt: dataSource.createdAt,
          updatedAt: Timestamp.now(),
        });
        // Convert apiHeaders object to array for editing
        if (dataSource.apiHeaders) {
          setApiHeaders(
            Object.entries(dataSource.apiHeaders).map(([key, value]) => ({ key, value }))
          );
        } else {
          setApiHeaders([]);
        }
      } else {
        setForm(createEmptyDataSource(workspaceId));
        setApiHeaders([]);
      }
      setErrors({});
    }
  }, [isOpen, dataSource, workspaceId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    // Type-specific validation
    if (form.type === 'pipeline' && !form.pipelineId) {
      newErrors.pipelineId = 'Selecciona un pipeline';
    }

    if (form.type === 'google_sheets' && !form.sheetId) {
      newErrors.sheetId = 'El ID de la hoja es requerido';
    }

    if (form.type === 'api' && !form.apiEndpoint) {
      newErrors.apiEndpoint = 'La URL del endpoint es requerida';
    }

    if (form.type === 'property' && (!form.hubspotProperties || form.hubspotProperties.length === 0)) {
      newErrors.hubspotProperties = 'Agrega al menos una propiedad';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    try {
      setSaving(true);

      // Convert apiHeaders array back to object
      const apiHeadersObj = apiHeaders.reduce((acc, { key, value }) => {
        if (key.trim()) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      const dataToSave = {
        ...form,
        apiHeaders: form.type === 'api' ? apiHeadersObj : undefined,
      };

      if (dataSource) {
        await dataSourceService.update(dataSource.id, {
          ...dataToSave,
          updatedAt: Timestamp.now(),
        });
        toast.success('Fuente de datos actualizada');
      } else {
        await dataSourceService.create({
          ...dataToSave,
          workspaceId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Fuente de datos creada');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error('Error al guardar');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const addVariable = () => {
    setForm((prev) => ({
      ...prev,
      variables: [...prev.variables, createEmptyVariable()],
    }));
  };

  const removeVariable = (index: number) => {
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }));
  };

  const updateVariable = (index: number, updates: Partial<DataSourceVariable>) => {
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.map((v, i) =>
        i === index ? { ...v, ...updates } : v
      ),
    }));
  };

  const addApiHeader = () => {
    setApiHeaders((prev) => [...prev, { key: '', value: '' }]);
  };

  const removeApiHeader = (index: number) => {
    setApiHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  const updateApiHeader = (index: number, field: 'key' | 'value', value: string) => {
    setApiHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  };

  const addHubspotProperty = () => {
    setForm((prev) => ({
      ...prev,
      hubspotProperties: [...(prev.hubspotProperties || []), ''],
    }));
  };

  const removeHubspotProperty = (index: number) => {
    setForm((prev) => ({
      ...prev,
      hubspotProperties: prev.hubspotProperties?.filter((_, i) => i !== index),
    }));
  };

  const updateHubspotProperty = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      hubspotProperties: prev.hubspotProperties?.map((p, i) =>
        i === index ? value : p
      ),
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={dataSource ? 'Editar Fuente de Datos' : 'Nueva Fuente de Datos'}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : dataSource ? 'Actualizar' : 'Crear Fuente'}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-6">
        {/* Name and description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la fuente <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, name: e.target.value }));
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent ${
              errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Ej: Métricas Semanales Kioscos"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción (opcional)
          </label>
          <textarea
            value={form.description || ''}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
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
                  setForm((prev) => ({ ...prev, type: type.value }))
                }
                className={`flex items-center space-x-3 p-3 rounded-lg border-2 text-left transition-colors ${
                  form.type === type.value
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

        {/* Type-specific configuration: PIPELINE */}
        {form.type === 'pipeline' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 flex items-center space-x-2">
              <GitBranch className="w-4 h-4" />
              <span>Configuración de Pipeline</span>
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pipeline <span className="text-red-500">*</span>
              </label>
              <select
                value={form.pipelineId || ''}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, pipelineId: e.target.value }));
                  if (errors.pipelineId) setErrors((prev) => ({ ...prev, pipelineId: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent ${
                  errors.pipelineId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="">Seleccionar pipeline...</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
              {errors.pipelineId && (
                <p className="mt-1 text-xs text-red-500">{errors.pipelineId}</p>
              )}
              {pipelines.length === 0 && (
                <p className="mt-1 text-xs text-yellow-600 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Primero configura un pipeline en la pestaña de Pipelines</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categorías de etapas a incluir
              </label>
              <div className="flex flex-wrap gap-2">
                {STAGE_CATEGORIES.filter((c) => c.value !== 'lost').map((cat) => {
                  const isSelected = form.stageCategories?.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        const current = form.stageCategories || [];
                        const updated = isSelected
                          ? current.filter((c) => c !== cat.value)
                          : [...current, cat.value];
                        setForm((prev) => ({
                          ...prev,
                          stageCategories: updated as StageCategory[],
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
              <p className="mt-1 text-xs text-gray-500">
                Selecciona qué etapas quieres incluir en las métricas
              </p>
            </div>
          </div>
        )}

        {/* Type-specific configuration: PROPERTY */}
        {form.type === 'property' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 flex items-center space-x-2">
              <Layers className="w-4 h-4" />
              <span>Configuración de Propiedades HubSpot</span>
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de objeto
              </label>
              <select
                value={form.hubspotObjectType || 'deals'}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, hubspotObjectType: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              >
                {HUBSPOT_OBJECT_TYPES.map((obj) => (
                  <option key={obj.value} value={obj.value}>
                    {obj.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Propiedades a consultar <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addHubspotProperty}
                  className="text-sm text-slack-purple hover:text-slack-purple/80"
                >
                  + Agregar propiedad
                </button>
              </div>

              {errors.hubspotProperties && (
                <p className="mb-2 text-xs text-red-500">{errors.hubspotProperties}</p>
              )}

              {(!form.hubspotProperties || form.hubspotProperties.length === 0) ? (
                <div className="text-center py-4 bg-white rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-500">
                    Agrega las propiedades de HubSpot que quieres consultar
                  </p>
                  <button
                    type="button"
                    onClick={addHubspotProperty}
                    className="mt-2 text-sm text-slack-purple hover:underline"
                  >
                    + Agregar propiedad
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.hubspotProperties.map((prop, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={prop}
                        onChange={(e) => updateHubspotProperty(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="nombre_propiedad"
                      />
                      <button
                        type="button"
                        onClick={() => removeHubspotProperty(index)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        aria-label="Eliminar propiedad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Usa el nombre interno de la propiedad en HubSpot (ej: firstname, deal_amount)
              </p>
            </div>
          </div>
        )}

        {/* Type-specific configuration: GOOGLE SHEETS */}
        {form.type === 'google_sheets' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Configuración de Google Sheets</span>
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID de la hoja <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.sheetId || ''}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, sheetId: e.target.value }));
                  if (errors.sheetId) setErrors((prev) => ({ ...prev, sheetId: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm ${
                  errors.sheetId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              />
              {errors.sheetId && (
                <p className="mt-1 text-xs text-red-500">{errors.sheetId}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                El ID está en la URL de la hoja: docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rango de celdas (opcional)
              </label>
              <input
                type="text"
                value={form.sheetRange || ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sheetRange: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
                placeholder="Sheet1!A1:D10"
              />
              <p className="mt-1 text-xs text-gray-500">
                Formato: NombreHoja!A1:D10. Déjalo vacío para leer toda la hoja.
              </p>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                <strong>Importante:</strong> Asegúrate de que la hoja esté compartida con la cuenta de servicio
                del proyecto para que pueda acceder a los datos.
              </p>
            </div>
          </div>
        )}

        {/* Type-specific configuration: API */}
        {form.type === 'api' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>Configuración de API Externa</span>
            </h4>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método
                </label>
                <select
                  value={form.apiMethod || 'GET'}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, apiMethod: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del endpoint <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={form.apiEndpoint || ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, apiEndpoint: e.target.value }));
                    if (errors.apiEndpoint) setErrors((prev) => ({ ...prev, apiEndpoint: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm ${
                    errors.apiEndpoint ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="https://api.example.com/data"
                />
                {errors.apiEndpoint && (
                  <p className="mt-1 text-xs text-red-500">{errors.apiEndpoint}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <Key className="w-3 h-3" />
                  <span>Headers (opcional)</span>
                </label>
                <button
                  type="button"
                  onClick={addApiHeader}
                  className="text-sm text-slack-purple hover:text-slack-purple/80"
                >
                  + Agregar header
                </button>
              </div>

              {apiHeaders.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Agrega headers si necesitas autenticación u otros parámetros
                </p>
              ) : (
                <div className="space-y-2">
                  {apiHeaders.map((header, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => updateApiHeader(index, 'key', e.target.value)}
                        className="w-1/3 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="Header name"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => updateApiHeader(index, 'value', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                        placeholder="Header value"
                      />
                      <button
                        type="button"
                        onClick={() => removeApiHeader(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        aria-label="Eliminar header"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-700">
                <strong>Seguridad:</strong> No almacenes tokens de producción directamente.
                Considera usar variables de entorno en las Cloud Functions.
              </p>
            </div>
          </div>
        )}

        {/* Date range - applies to all types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rango de fechas predeterminado
          </label>
          <select
            value={form.dateRange}
            onChange={(e) =>
              setForm((prev) => ({
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
          <p className="mt-1 text-xs text-gray-500">
            Este rango se usa por defecto al consultar la fuente
          </p>
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
              className="text-sm text-slack-purple hover:text-slack-purple/80 flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>Agregar variable</span>
            </button>
          </div>

          {form.variables.length === 0 && (
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
            {form.variables.map((variable, index) => (
              <div key={index} className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
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
                  aria-label="Eliminar variable"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {form.variables.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Uso en mensajes:</strong>{' '}
                {form.variables
                  .filter((v) => v.key)
                  .map((v) => `{{${v.key}}}`)
                  .join(', ') || 'Define claves para ver el preview'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export { DATA_SOURCE_TYPES, DATE_RANGES };
