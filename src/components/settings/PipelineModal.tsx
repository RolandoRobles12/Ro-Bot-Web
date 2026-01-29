import { useState, useEffect } from 'react';
import { Trash2, GripVertical, Layers } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { pipelineService } from '@/services/firestore';
import type { Pipeline, PipelineStage, StageCategory } from '@/types';

const STAGE_CATEGORIES: { value: StageCategory; label: string; color: string; description: string }[] = [
  { value: 'new', label: 'Nuevo', color: 'bg-blue-500', description: 'Recién creado' },
  { value: 'in_progress', label: 'En proceso', color: 'bg-yellow-500', description: 'Trabajando en ello' },
  { value: 'advanced', label: 'Avanzado', color: 'bg-purple-500', description: 'Progreso significativo' },
  { value: 'won', label: 'Ganado', color: 'bg-green-500', description: 'Cerrado exitosamente' },
  { value: 'lost', label: 'Perdido', color: 'bg-red-500', description: 'No se concretó' },
];

const PIPELINE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const PIPELINE_ICONS = ['💼', '🏪', '🤝', '📈', '🎯', '💰', '🚀', '⭐', '🔥', '💎'];

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

const createEmptyStage = (order: number): PipelineStage => ({
  id: `stage_${Date.now()}_${order}`,
  name: '',
  category: 'new',
  order,
});

interface PipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipeline?: Pipeline | null;
  workspaceId: string;
  onSaved: () => void;
}

export function PipelineModal({
  isOpen,
  onClose,
  pipeline,
  workspaceId,
  onSaved,
}: PipelineModalProps) {
  const [form, setForm] = useState<Omit<Pipeline, 'id'>>(createEmptyPipeline(workspaceId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (pipeline) {
        setForm({
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
        setForm(createEmptyPipeline(workspaceId));
      }
      setErrors({});
    }
  }, [isOpen, pipeline, workspaceId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (!form.hubspotPipelineId.trim()) {
      newErrors.hubspotPipelineId = 'El Pipeline ID de HubSpot es requerido';
    }

    // Validate stages have names
    const emptyStages = form.stages.filter(s => !s.name.trim());
    if (emptyStages.length > 0) {
      newErrors.stages = 'Todas las etapas deben tener nombre';
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
      if (pipeline) {
        await pipelineService.update(pipeline.id, {
          ...form,
          updatedAt: Timestamp.now(),
        });
        toast.success('Pipeline actualizado');
      } else {
        await pipelineService.create({
          ...form,
          workspaceId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Pipeline creado');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error('Error al guardar pipeline');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    setForm((prev) => ({
      ...prev,
      stages: [...prev.stages, createEmptyStage(prev.stages.length)],
    }));
  };

  const removeStage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index),
    }));
  };

  const updateStage = (index: number, updates: Partial<PipelineStage>) => {
    setForm((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, i) =>
        i === index ? { ...stage, ...updates } : stage
      ),
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pipeline ? 'Editar Pipeline' : 'Nuevo Pipeline'}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : pipeline ? 'Actualizar' : 'Crear Pipeline'}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-6">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del pipeline <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ej: Ventas Kioscos"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HubSpot Pipeline ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.hubspotPipelineId}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, hubspotPipelineId: e.target.value }));
                if (errors.hubspotPipelineId) setErrors(prev => ({ ...prev, hubspotPipelineId: '' }));
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm ${
                errors.hubspotPipelineId ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="default"
            />
            {errors.hubspotPipelineId && (
              <p className="mt-1 text-xs text-red-500">{errors.hubspotPipelineId}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Encuéntralo en HubSpot {'>'} Settings {'>'} Objects {'>'} Deals {'>'} Pipelines
            </p>
          </div>
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
            placeholder="Describe para qué se usa este pipeline"
          />
        </div>

        {/* Metric configuration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Métrica principal
          </label>
          <div className="flex space-x-4">
            {[
              { value: 'deals', label: 'Número de deals', description: 'Cuenta la cantidad de deals' },
              { value: 'amount', label: 'Monto total', description: 'Suma el valor de los deals' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start space-x-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="countMetric"
                  value={opt.value}
                  checked={form.countMetric === opt.value}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      countMetric: opt.value as 'deals' | 'amount',
                    }))
                  }
                  className="mt-1 text-slack-purple focus:ring-slack-purple"
                />
                <div>
                  <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {form.countMetric === 'amount' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Propiedad de monto en HubSpot
            </label>
            <input
              type="text"
              value={form.amountProperty || ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amountProperty: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent font-mono text-sm"
              placeholder="amount"
            />
            <p className="mt-1 text-xs text-gray-500">
              Nombre interno de la propiedad en HubSpot (ej: amount, deal_value)
            </p>
          </div>
        )}

        {/* Icon and color */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icono</label>
            <div className="flex flex-wrap gap-2">
              {PIPELINE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon }))}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg transition-colors ${
                    form.icon === icon
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
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.color === color
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
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

          {errors.stages && (
            <p className="mb-2 text-xs text-red-500">{errors.stages}</p>
          )}

          {form.stages.length === 0 && (
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
            {form.stages.map((stage, index) => (
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
                  aria-label="Eliminar etapa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Category legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {STAGE_CATEGORIES.map((cat) => (
              <div key={cat.value} className="flex items-center space-x-1.5" title={cat.description}>
                <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                <span className="text-xs text-gray-500">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export { STAGE_CATEGORIES, PIPELINE_COLORS, PIPELINE_ICONS };
