import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Plus,
  Trash2,
  Edit2,
  GitBranch,
  Globe,
  Sparkles,
  CheckCircle2,

  Code2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import { dataSourceService, pipelineService, customPropertyService } from '@/services/firestore';
import type {
  DataSource,
  DataSourceVariable,
  DataSourceFilter,
  DataSourceType,
  DateRangeType,
  Pipeline,
  PipelineStage,
  CustomHubSpotProperty,
} from '@/types';

// ==========================================================================
// Constants
// ==========================================================================

const DATA_SOURCE_TYPES: { value: DataSourceType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'pipeline', label: 'Pipeline HubSpot', icon: GitBranch, description: 'Métricas de solicitudes, ventas y desempeño' },
  { value: 'api', label: 'API Externa', icon: Globe, description: 'Datos desde un endpoint REST externo' },
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

const FILTER_OPERATORS: { value: DataSourceFilter['operator']; label: string }[] = [
  { value: 'EQ', label: 'es igual a' },
  { value: 'NEQ', label: 'no es igual a' },
  { value: 'CONTAINS', label: 'contiene' },
];

const TYPE_ICONS: Record<DataSourceType, string> = {
  pipeline: '📊',
  property: '🔍',
  manual: '✏️',
  api: '🌐',
};


// ==========================================================================
// Helpers
// ==========================================================================

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function createEmptyDataSource(workspaceId: string): Omit<DataSource, 'id'> {
  return {
    workspaceId,
    name: '',
    type: 'pipeline',
    icon: '📊',
    dateRange: 'this_week',
    variables: [],
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function createEmptyVariable(): DataSourceVariable {
  return { key: '', label: '', type: 'number' };
}

const createEmptyFilter = (): DataSourceFilter => ({ propertyName: '', operator: 'EQ', value: '' });

/** Genera variables: solicitudes siempre incluido + una por cada stage seleccionado */
function autoGenerateVariables(stages: Pick<PipelineStage, 'id' | 'name'>[]): DataSourceVariable[] {
  return [
    { key: 'solicitudes', label: 'Total solicitudes del período', type: 'number' as const },
    ...stages.map((s) => ({
      key: toSlug(s.name),
      label: s.name,
      type: 'number' as const,
    })),
  ];
}

// ==========================================================================
// Component
// ==========================================================================

interface DataSourcesProps {
  embedded?: boolean;
  onNavigateToPipelines?: () => void;
}
export function DataSources({ embedded = false, onNavigateToPipelines }: DataSourcesProps = {}) {
  const navigate = useNavigate();
  const { selectedWorkspace } = useAppStore();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [customProperties, setCustomProperties] = useState<CustomHubSpotProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDs, setEditingDs] = useState<DataSource | null>(null);
  const [form, setForm] = useState<Omit<DataSource, 'id'>>(createEmptyDataSource(''));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedWorkspace?.id) {
      loadAll();
    }
  }, [selectedWorkspace?.id]);

  const loadAll = async () => {
    if (!selectedWorkspace?.id) return;
    setLoading(true);
    try {
      const [ds, pl, props] = await Promise.all([
        dataSourceService.getByWorkspace(selectedWorkspace.id),
        pipelineService.getByWorkspace(selectedWorkspace.id),
        customPropertyService.getByWorkspace(selectedWorkspace.id),
      ]);
      setDataSources(ds);
      setPipelines(pl);
      setCustomProperties(props);
    } catch {
      toast.error('Error al cargar fuentes de datos');
    } finally {
      setLoading(false);
    }
  };

  // ── Modal handlers ──────────────────────────────────────────────────────

  const openModal = (ds?: DataSource) => {
    if (ds) {
      setEditingDs(ds);
      setForm({ ...ds, updatedAt: Timestamp.now() });
    } else {
      setEditingDs(null);
      const base = createEmptyDataSource(selectedWorkspace?.id || '');
      if (pipelines.length === 1) base.pipelineId = pipelines[0].id;
      setForm(base);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDs(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      // Normalize filters: resolve __custom__ entries and drop incomplete rows
      const normalizedFilters = (form.additionalFilters || [])
        .map(f => f.propertyName === '__custom__' ? { ...f, propertyName: (f as any)._customName || '' } : f)
        .filter(f => f.propertyName && f.value);
      const formToSave = { ...form, additionalFilters: normalizedFilters };

      if (editingDs) {
        await dataSourceService.update(editingDs.id, { ...formToSave, updatedAt: Timestamp.now() });
        toast.success('Fuente de datos actualizada');
      } else {
        await dataSourceService.create({
          ...formToSave,
          workspaceId: selectedWorkspace?.id || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Fuente de datos creada');
      }
      closeModal();
      loadAll();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dsId: string) => {
    if (!confirm('¿Eliminar esta fuente de datos?')) return;
    try {
      await dataSourceService.delete(dsId);
      toast.success('Eliminada');
      loadAll();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // ── Variable helpers ─────────────────────────────────────────────────────

  const addVariable = () =>
    setForm((p) => ({ ...p, variables: [...p.variables, createEmptyVariable()] }));
  const removeVariable = (i: number) =>
    setForm((p) => ({ ...p, variables: p.variables.filter((_, idx) => idx !== i) }));
  const updateVariable = (i: number, updates: Partial<DataSourceVariable>) =>
    setForm((p) => ({
      ...p,
      variables: p.variables.map((v, idx) => (idx === i ? { ...v, ...updates } : v)),
    }));

  // ── Filter helpers ───────────────────────────────────────────────────────

  const addFilter = () =>
    setForm((p) => ({ ...p, additionalFilters: [...(p.additionalFilters || []), createEmptyFilter()] }));
  const removeFilter = (i: number) =>
    setForm((p) => ({ ...p, additionalFilters: (p.additionalFilters || []).filter((_, idx) => idx !== i) }));
  const updateFilter = (i: number, updates: Partial<DataSourceFilter>) =>
    setForm((p) => ({
      ...p,
      additionalFilters: (p.additionalFilters || []).map((f, idx) => (idx === i ? { ...f, ...updates } : f)),
    }));

  // ── Derived ──────────────────────────────────────────────────────────────


  useEffect(() => {
    if (form.type !== 'pipeline' || !form.pipelineId) return;
    const pipeline = pipelines.find((p) => p.id === form.pipelineId);
    if (!pipeline) return;
    const selected = pipeline.stages.filter((s) => (form.stageIds || []).includes(s.id));
    setForm((prev) => ({ ...prev, variables: autoGenerateVariables(selected) }));
  }, [form.stageIds, form.type, form.pipelineId, pipelines]);

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Selecciona un workspace para ver las fuentes de datos.
      </div>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Header — hidden when embedded (Settings provides its own heading) */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fuentes de Datos</h1>
            <p className="mt-1 text-gray-500">
              Define de dónde se obtienen las métricas que alimentan tus campañas.
              Las variables de cada fuente estarán disponibles en los mensajes como{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{'{{variable}}'}</code>.
            </p>
          </div>
          <Button onClick={() => openModal()} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Nueva Fuente</span>
          </Button>
        </div>
      )}

      {/* Header for embedded mode */}
      {embedded && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Define las métricas que alimentan tus campañas. Las variables estarán disponibles como{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{'{{variable}}'}</code>.
          </p>
          <Button onClick={() => openModal()} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Nueva Fuente</span>
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && dataSources.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm mb-3">Aún no hay fuentes de datos</p>
          <Button onClick={() => openModal()} className="flex items-center space-x-2 mx-auto">
            <Plus className="w-4 h-4" />
            <span>Nueva Fuente</span>
          </Button>
        </div>
      )}

      {/* Data sources list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando…</div>
      ) : dataSources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dataSources.map((ds) => {
            const TypeIcon = DATA_SOURCE_TYPES.find((t) => t.value === ds.type)?.icon || Database;
            const linkedPipeline = pipelines.find((p) => p.id === ds.pipelineId);
            return (
              <Card key={ds.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slack-purple/10 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                      {ds.icon || TYPE_ICONS[ds.type]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{ds.name}</p>
                      <span className="inline-flex items-center space-x-1 text-xs text-gray-500">
                        <TypeIcon className="w-3 h-3" />
                        <span>{DATA_SOURCE_TYPES.find((t) => t.value === ds.type)?.label}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => openModal(ds)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(ds.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {ds.description && (
                  <p className="text-xs text-gray-500 mb-3">{ds.description}</p>
                )}

                <div className="mt-auto space-y-2">
                  {linkedPipeline && (
                    <div className="flex items-center space-x-1.5 text-xs text-gray-600">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: linkedPipeline.color || '#6366f1' }}
                      />
                      <span>{linkedPipeline.name}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{DATE_RANGES.find((d) => d.value === ds.dateRange)?.label || ds.dateRange}</span>
                    <span>{ds.variables.length} variable{ds.variables.length !== 1 ? 's' : ''}</span>
                  </div>

                  {ds.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
                      {ds.variables.slice(0, 4).map((v) => (
                        <span key={v.key} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                          {`{{${v.key}}}`}
                        </span>
                      ))}
                      {ds.variables.length > 4 && (
                        <span className="text-xs text-gray-400">+{ds.variables.length - 4} más</span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {/* Add new card */}
          <button
            onClick={() => openModal()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-gray-400 hover:border-slack-purple hover:text-slack-purple transition-colors min-h-[160px]"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Nueva fuente</span>
          </button>
        </div>
      ) : null}

      {/* Link to campaigns */}
      {dataSources.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                {dataSources.length} fuente{dataSources.length !== 1 ? 's' : ''} configurada{dataSources.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-blue-600">
                Selecciónalas al crear una campaña para incluir métricas automáticamente.
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate('/scheduler')} className="text-blue-700 text-sm">
            Crear campaña →
          </Button>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL                                                          */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingDs ? 'Editar fuente de datos' : 'Nueva fuente de datos'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Las variables exportadas estarán disponibles en el constructor de campañas.
                </p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── 1. Basic info ────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Información básica</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Métricas Semanales Kioscos"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                  <input
                    type="text"
                    value={form.description || ''}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="¿Para qué se usa esta fuente?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  />
                </div>
              </div>

              {/* ── 2. Type selector ─────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tipo de fuente</h3>
                <div className="grid grid-cols-2 gap-3">
                  {DATA_SOURCE_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isSelected = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, type: t.value, pipelineId: undefined, hubspotProperties: undefined }))}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          isSelected
                            ? 'border-slack-purple bg-slack-purple/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-slack-purple' : 'text-gray-500'}`} />
                          <span className={`text-sm font-medium ${isSelected ? 'text-slack-purple' : 'text-gray-700'}`}>
                            {t.label}
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-slack-purple ml-auto" />}
                        </div>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── 3. Pipeline config ───────────────────────── */}
              {form.type === 'pipeline' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-slack-purple" />
                    <span>Configuración del Pipeline</span>
                  </h3>

                  {/* Pipeline indicator */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pipeline de HubSpot
                    </label>
                    {pipelines.length === 0 ? (
                      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        No hay pipelines configurados.{' '}
                        <button
                          type="button"
                          onClick={() => { closeModal(); onNavigateToPipelines ? onNavigateToPipelines() : navigate('/settings'); }}
                          className="underline"
                        >
                          Agregar en Configuración →
                        </button>
                      </div>
                    ) : pipelines.length === 1 ? (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pipelines[0].color || '#6366f1' }} />
                        <span className="font-medium">{pipelines[0].icon} {pipelines[0].name}</span>
                        <span className="text-gray-400 text-xs ml-auto">Único pipeline</span>
                      </div>
                    ) : (
                      <select
                        value={form.pipelineId || ''}
                        onChange={(e) => setForm((p) => ({ ...p, pipelineId: e.target.value || undefined }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple bg-white"
                      >
                        <option value="">— Seleccionar pipeline —</option>
                        {pipelines.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.icon} {pl.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Variables de pipeline */}
                  {form.pipelineId && (
                    <div className="space-y-3">
                      {/* solicitudes — siempre incluido */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Variable siempre incluida</p>
                        <div className="flex items-center justify-between px-3 py-2 bg-slack-purple/5 border border-slack-purple/20 rounded-lg">
                          <span className="text-sm text-gray-700">Total solicitudes del período</span>
                          <span className="text-xs font-mono text-slack-purple">{`{{solicitudes}}`}</span>
                        </div>
                      </div>

                      {/* stages opcionales */}
                      {(() => {
                        const pipeline = pipelines.find((p) => p.id === form.pipelineId);
                        if (!pipeline || pipeline.stages.length === 0) return null;
                        return (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              Etapas adicionales{' '}
                              <span className="text-xs text-gray-400 font-normal">— opcional</span>
                            </p>
                            <div className="space-y-1.5">
                              {pipeline.stages.map((stage) => {
                                const checked = (form.stageIds || []).includes(stage.id);
                                return (
                                  <label key={stage.id} className="flex items-center space-x-3 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const ids = form.stageIds || [];
                                        setForm((p) => ({
                                          ...p,
                                          stageIds: e.target.checked
                                            ? [...ids, stage.id]
                                            : ids.filter((id) => id !== stage.id),
                                        }));
                                      }}
                                      className="rounded text-slack-purple"
                                    />
                                    <span className="text-sm text-gray-700 flex-1">{stage.name}</span>
                                    <span className="text-xs font-mono text-gray-400">{`{{${toSlug(stage.name)}}}`}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* filterByOwner toggle */}
                  {form.pipelineId && (
                    <label className="flex items-start space-x-3 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={form.filterByOwner !== false}
                        onChange={(e) => setForm((p) => ({ ...p, filterByOwner: e.target.checked }))}
                        className="mt-0.5 rounded text-slack-purple"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Filtrar por deal owner</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Activo: cuenta solo los deals asignados al destinatario del mensaje.<br />
                          Inactivo: cuenta todos los deals del pipeline (métricas de equipo).
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* ── 3c. Additional filters ──────────────────────── */}
              {form.type === 'pipeline' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Filtros adicionales</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Filtra los deals por propiedades custom de HubSpot. El valor de cada filtro queda disponible como variable en los mensajes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addFilter}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar</span>
                    </button>
                  </div>

                  {customProperties.length === 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                      Para usar el catálogo de propiedades, primero{' '}
                      <button type="button" onClick={() => { closeModal(); navigate('/settings'); }} className="underline font-medium">
                        registra tus propiedades en Configuración
                      </button>
                      . Por ahora puedes usar "Propiedad custom (texto libre)".
                    </div>
                  )}

                  {(form.additionalFilters || []).length === 0 ? (
                    <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
                      Sin filtros — se incluyen todos los deals del pipeline
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(form.additionalFilters || []).map((f, i) => {
                        const catalogProp = customProperties.find(p => p.name === f.propertyName);
                        return (
                          <div key={i} className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-2">
                              {/* Property selector */}
                              <div className="flex-1">
                                <select
                                  value={f.propertyName}
                                  onChange={(e) => updateFilter(i, { propertyName: e.target.value, value: '' })}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slack-purple"
                                >
                                  <option value="">— Seleccionar propiedad —</option>
                                  {customProperties.map(p => (
                                    <option key={p.id} value={p.name}>{p.label}</option>
                                  ))}
                                  <option value="__custom__">Propiedad custom (texto libre)…</option>
                                </select>
                              </div>

                              {/* Operator */}
                              <select
                                value={f.operator}
                                onChange={(e) => updateFilter(i, { operator: e.target.value as DataSourceFilter['operator'] })}
                                className="w-32 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slack-purple"
                              >
                                {FILTER_OPERATORS.map(op => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>

                              <button onClick={() => removeFilter(i)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Custom property name input (only when __custom__ selected) */}
                            {f.propertyName === '__custom__' && (
                              <input
                                type="text"
                                value={(f as any)._customName || ''}
                                onChange={(e) => updateFilter(i, { _customName: e.target.value, propertyName: e.target.value || '__custom__' } as any)}
                                placeholder="Nombre interno en HubSpot"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slack-purple"
                              />
                            )}

                            {/* Value input */}
                            {f.propertyName && f.propertyName !== '__custom__' && (
                              <div>
                                {catalogProp?.type === 'enum' && catalogProp.enumOptions?.length ? (
                                  <select
                                    value={f.value}
                                    onChange={(e) => {
                                      const selectedOpt = (catalogProp.enumOptions as any[]).find((o: any) =>
                                        (typeof o === 'string' ? o : o.value) === e.target.value
                                      );
                                      updateFilter(i, {
                                        value: e.target.value,
                                        displayValue: selectedOpt && typeof selectedOpt !== 'string' ? selectedOpt.label : e.target.value,
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slack-purple"
                                  >
                                    <option value="">— Seleccionar valor —</option>
                                    {(catalogProp.enumOptions as any[]).map((opt: any) => {
                                      const val = typeof opt === 'string' ? opt : opt.value;
                                      const lbl = typeof opt === 'string' ? opt : opt.label;
                                      return <option key={val} value={val}>{lbl}</option>;
                                    })}
                                  </select>
                                ) : catalogProp?.type === 'date' ? (
                                  <input
                                    type="date"
                                    value={f.value}
                                    onChange={(e) => updateFilter(i, { value: e.target.value, displayValue: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={f.value}
                                    onChange={(e) => updateFilter(i, { value: e.target.value })}
                                    placeholder={catalogProp?.type === 'number' ? 'Valor numérico' : `Valor de ${catalogProp?.label || f.propertyName}`}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple"
                                  />
                                )}
                              </div>
                            )}

                            {/* Preview of resulting variable */}
                            {f.propertyName && f.propertyName !== '__custom__' && f.value && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                                <span>Variable generada:</span>
                                <code className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded font-mono">
                                  {`{{${f.propertyName}}}`}
                                </code>
                                <span>= "{(f as any).displayValue || f.value}"</span>
                                {catalogProp && <span className="text-gray-400">· {catalogProp.label}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── 3b. API config ───────────────────────────── */}
              {form.type === 'api' && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Configuración de API</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL del endpoint</label>
                    <input
                      type="url"
                      value={form.apiEndpoint || ''}
                      onChange={(e) => setForm((p) => ({ ...p, apiEndpoint: e.target.value }))}
                      placeholder="https://api.ejemplo.com/metricas"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {/* ── 4. Date range ────────────────────────────── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rango de fechas por defecto
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DATE_RANGES.map((dr) => (
                    <button
                      key={dr.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, dateRange: dr.value }))}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-colors ${
                        form.dateRange === dr.value
                          ? 'border-slack-purple bg-slack-purple text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {dr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 5. Variables ─────────────────────────────── */}
              {form.type === 'pipeline' ? (
                /* Pipeline: preview de solo lectura — las variables son automáticas */
                form.pipelineId ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Variables disponibles en los mensajes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {form.variables.map((v) => v.key && (
                        <div key={v.key} className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                          <code className="text-xs font-mono text-slack-purple">{`{{${v.key}}}`}</code>
                          <span className="text-xs text-gray-500">{v.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              ) : (
                /* Otros tipos: editor manual */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Variables exportadas</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Se usarán como <code className="bg-gray-100 px-1 rounded">{`{{clave}}`}</code> en los mensajes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addVariable}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar</span>
                    </button>
                  </div>
                  {form.variables.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                      <Code2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      Haz clic en "Agregar" para definir las variables que exporta esta fuente
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.variables.map((v, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={v.key}
                            onChange={(e) => updateVariable(i, { key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                            placeholder="clave_variable"
                            className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-slack-purple"
                          />
                          <input
                            type="text"
                            value={v.label}
                            onChange={(e) => updateVariable(i, { label: e.target.value })}
                            placeholder="Etiqueta visible"
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple"
                          />
                          <select
                            value={v.type}
                            onChange={(e) => updateVariable(i, { type: e.target.value as DataSourceVariable['type'] })}
                            className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slack-purple"
                          >
                            <option value="number">Número</option>
                            <option value="currency">Moneda</option>
                            <option value="percentage">Porcentaje</option>
                            <option value="text">Texto</option>
                            <option value="date">Fecha</option>
                          </select>
                          <button onClick={() => removeVariable(i)} className="p-1.5 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : editingDs ? 'Actualizar' : 'Crear fuente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
