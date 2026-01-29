import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Power,
  Zap,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Send,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import {
  ruleService,
  workspaceService,
  templateService,
} from '@/services/firestore';
import type {
  MessageRule,
  RuleCondition,
  RuleAction,
  SlackWorkspace,
  MessageTemplate,
} from '@/types';

// Operators for conditions
const OPERATORS = [
  { value: 'equals', label: 'Es igual a', symbol: '=' },
  { value: 'not_equals', label: 'Es diferente de', symbol: '≠' },
  { value: 'greater_than', label: 'Es mayor que', symbol: '>' },
  { value: 'less_than', label: 'Es menor que', symbol: '<' },
  { value: 'contains', label: 'Contiene', symbol: '∋' },
  { value: 'between', label: 'Está entre', symbol: '↔' },
] as const;

// Action types
const ACTION_TYPES = [
  { value: 'send_message', label: 'Enviar mensaje', icon: Send, description: 'Envía un mensaje de Slack' },
  { value: 'webhook', label: 'Llamar webhook', icon: Zap, description: 'Ejecuta una solicitud HTTP' },
] as const;

// Create empty condition
const createEmptyCondition = (): RuleCondition => ({
  type: 'hubspot_property',
  property: '',
  operator: 'equals',
  value: '',
});

// Create empty action
const createEmptyAction = (): RuleAction => ({
  type: 'send_message',
  recipients: [],
});

export function Rules() {
  const { selectedWorkspace } = useAppStore();
  const [rules, setRules] = useState<MessageRule[]>([]);
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MessageRule | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formConditions, setFormConditions] = useState<RuleCondition[]>([createEmptyCondition()]);
  const [formActions, setFormActions] = useState<RuleAction[]>([createEmptyAction()]);
  const [saving, setSaving] = useState(false);

  // UI state
  const [expandedCondition, setExpandedCondition] = useState<number | null>(0);
  const [expandedAction, setExpandedAction] = useState<number | null>(0);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace?.id) {
      loadRules();
      loadTemplates();
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

  const loadRules = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      setLoading(true);
      const data = await ruleService.getByWorkspace(selectedWorkspace.id);
      setRules(data);
    } catch (error) {
      toast.error('Error al cargar reglas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    if (!selectedWorkspace?.id) return;
    try {
      const data = await templateService.getByWorkspace(selectedWorkspace.id);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormName('');
    setFormDescription('');
    setFormConditions([createEmptyCondition()]);
    setFormActions([createEmptyAction()]);
    setExpandedCondition(0);
    setExpandedAction(0);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: MessageRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description || '');
    setFormConditions(rule.conditions.length > 0 ? rule.conditions : [createEmptyCondition()]);
    setFormActions(rule.actions.length > 0 ? rule.actions : [createEmptyAction()]);
    setExpandedCondition(0);
    setExpandedAction(0);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('El nombre de la regla es requerido');
      return;
    }
    if (!selectedWorkspace?.id) {
      toast.error('No hay workspace seleccionado');
      return;
    }

    // Validate at least one valid condition
    const validConditions = formConditions.filter((c) => c.property && c.value);
    if (validConditions.length === 0) {
      toast.error('Agrega al menos una condición válida');
      return;
    }

    try {
      setSaving(true);
      if (editingRule) {
        await ruleService.update(editingRule.id, {
          name: formName,
          description: formDescription,
          conditions: validConditions,
          actions: formActions,
          updatedAt: Timestamp.now(),
        });
        toast.success('Regla actualizada');
      } else {
        await ruleService.create({
          workspaceId: selectedWorkspace.id,
          name: formName,
          description: formDescription,
          conditions: validConditions,
          actions: formActions,
          isActive: true,
          createdBy: 'user',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Regla creada');
      }
      closeModal();
      loadRules();
    } catch (error) {
      toast.error('Error al guardar la regla');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleRuleStatus = async (rule: MessageRule) => {
    try {
      await ruleService.update(rule.id, { isActive: !rule.isActive });
      toast.success(`Regla ${rule.isActive ? 'desactivada' : 'activada'}`);
      loadRules();
    } catch (error) {
      toast.error('Error al actualizar estado');
      console.error(error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    try {
      await ruleService.delete(ruleId);
      toast.success('Regla eliminada');
      loadRules();
    } catch (error) {
      toast.error('Error al eliminar');
      console.error(error);
    }
  };

  // Condition helpers
  const addCondition = () => {
    setFormConditions([...formConditions, createEmptyCondition()]);
    setExpandedCondition(formConditions.length);
  };

  const removeCondition = (index: number) => {
    if (formConditions.length > 1) {
      setFormConditions(formConditions.filter((_, i) => i !== index));
      setExpandedCondition(null);
    }
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const newConditions = [...formConditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setFormConditions(newConditions);
  };

  // Action helpers
  const addAction = () => {
    setFormActions([...formActions, createEmptyAction()]);
    setExpandedAction(formActions.length);
  };

  const removeAction = (index: number) => {
    if (formActions.length > 1) {
      setFormActions(formActions.filter((_, i) => i !== index));
      setExpandedAction(null);
    }
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    const newActions = [...formActions];
    newActions[index] = { ...newActions[index], ...updates };
    setFormActions(newActions);
  };

  // Get operator label
  const getOperatorLabel = (operator: string) => {
    const op = OPERATORS.find((o) => o.value === operator);
    return op?.label || operator;
  };

  const currentWorkspace = workspaces.find((w) => w.id === selectedWorkspace?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reglas de Automatización</h1>
          <p className="mt-2 text-gray-600">
            Crea lógicas para automatizar acciones basadas en condiciones
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {/* Workspace indicator */}
      {currentWorkspace && (
        <div className="text-sm text-gray-500">
          Mostrando reglas de: <strong>{currentWorkspace.name}</strong>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple"></div>
        </div>
      ) : rules.length === 0 ? (
        <Card className="p-12 text-center">
          <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Sin reglas de automatización
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Las reglas te permiten automatizar acciones cuando se cumplen ciertas condiciones.
            Por ejemplo: enviar un mensaje cuando un campo tenga cierto valor.
          </p>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Crear primera regla
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center space-x-3">
                    <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        rule.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {rule.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {rule.description && (
                    <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                  )}

                  {/* Visual rule representation */}
                  <div className="mt-4 flex items-center flex-wrap gap-2 text-sm">
                    {/* Conditions */}
                    <div className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
                      <Filter className="w-4 h-4" />
                      <span>
                        {rule.conditions.length === 1 ? (
                          <>
                            <span className="font-medium">{rule.conditions[0].property}</span>
                            {' '}{getOperatorLabel(rule.conditions[0].operator)}{' '}
                            <span className="font-medium">{rule.conditions[0].value}</span>
                          </>
                        ) : (
                          <span>{rule.conditions.length} condiciones</span>
                        )}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-gray-400" />

                    {/* Actions */}
                    <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                      <Send className="w-4 h-4" />
                      <span>
                        {rule.actions.length === 1 ? (
                          rule.actions[0].type === 'send_message' ? 'Enviar mensaje' : 'Llamar webhook'
                        ) : (
                          <span>{rule.actions.length} acciones</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1 ml-4">
                  <button
                    onClick={() => toggleRuleStatus(rule)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.isActive
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={rule.isActive ? 'Desactivar' : 'Activar'}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openEditModal(rule)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingRule ? 'Editar Regla' : 'Nueva Regla'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la regla *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    placeholder="Ej: Alerta de negocio cerrado"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                    placeholder="Describe qué hace esta regla"
                  />
                </div>
              </div>

              {/* Conditions Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <h3 className="font-medium text-gray-900">Condiciones (SI...)</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-sm text-slack-purple hover:text-slack-purple/80"
                  >
                    + Agregar condición
                  </button>
                </div>

                <div className="space-y-2">
                  {formConditions.map((condition, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Condition Header */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCondition(expandedCondition === index ? null : index)
                        }
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-gray-500">Condición {index + 1}:</span>
                          {condition.property ? (
                            <span className="font-medium text-gray-900">
                              {condition.property}{' '}
                              <span className="text-gray-500">{getOperatorLabel(condition.operator)}</span>{' '}
                              {condition.value}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Sin configurar</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {formConditions.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCondition(index);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {expandedCondition === index ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Condition Body */}
                      {expandedCondition === index && (
                        <div className="p-4 space-y-3 bg-white">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Campo / Propiedad
                              </label>
                              <input
                                type="text"
                                value={condition.property || ''}
                                onChange={(e) =>
                                  updateCondition(index, { property: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                placeholder="Ej: status, deal_stage"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Operador
                              </label>
                              <select
                                value={condition.operator}
                                onChange={(e) =>
                                  updateCondition(index, { operator: e.target.value as RuleCondition['operator'] })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                              >
                                {OPERATORS.map((op) => (
                                  <option key={op.value} value={op.value}>
                                    {op.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Valor
                              </label>
                              <input
                                type="text"
                                value={condition.value}
                                onChange={(e) =>
                                  updateCondition(index, { value: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                placeholder="Valor a comparar"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {formConditions.length > 1 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Las condiciones se evalúan con lógica AND (todas deben cumplirse)
                  </p>
                )}
              </div>

              {/* Actions Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    <h3 className="font-medium text-gray-900">Acciones (ENTONCES...)</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addAction}
                    className="text-sm text-slack-purple hover:text-slack-purple/80"
                  >
                    + Agregar acción
                  </button>
                </div>

                <div className="space-y-2">
                  {formActions.map((action, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Action Header */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedAction(expandedAction === index ? null : index)
                        }
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-gray-500">Acción {index + 1}:</span>
                          <span className="font-medium text-gray-900">
                            {ACTION_TYPES.find((a) => a.value === action.type)?.label}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {formActions.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAction(index);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {expandedAction === index ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Action Body */}
                      {expandedAction === index && (
                        <div className="p-4 space-y-3 bg-white">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Tipo de acción
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {ACTION_TYPES.map((type) => (
                                <button
                                  key={type.value}
                                  type="button"
                                  onClick={() => updateAction(index, { type: type.value as RuleAction['type'] })}
                                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-left transition-colors text-sm ${
                                    action.type === type.value
                                      ? 'border-slack-purple bg-slack-purple/5 text-slack-purple'
                                      : 'border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <type.icon className="w-4 h-4" />
                                  <span>{type.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {action.type === 'send_message' && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Usar plantilla existente
                                </label>
                                <select
                                  value={action.templateId || ''}
                                  onChange={(e) =>
                                    updateAction(index, { templateId: e.target.value })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                >
                                  <option value="">Ninguna (usar mensaje personalizado)</option>
                                  {templates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  O escribe un mensaje personalizado
                                </label>
                                <textarea
                                  value={action.customMessage || ''}
                                  onChange={(e) =>
                                    updateAction(index, { customMessage: e.target.value })
                                  }
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                  placeholder="Escribe tu mensaje aquí. Puedes usar variables como {{nombre}}, {{valor}}, etc."
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  Usa {'{{variable}}'} para insertar datos dinámicos
                                </p>
                              </div>
                            </>
                          )}

                          {action.type === 'webhook' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                URL del webhook
                              </label>
                              <input
                                type="url"
                                value={action.webhookUrl || ''}
                                onChange={(e) =>
                                  updateAction(index, { webhookUrl: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                placeholder="https://..."
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Help text */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">¿Cómo funcionan las reglas?</p>
                    <p className="mt-1">
                      Cuando <strong>todas las condiciones</strong> se cumplen, se ejecutan las acciones configuradas.
                      Por ejemplo: "Si <em>status</em> es igual a <em>cerrado</em>, entonces enviar mensaje de felicitación."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button variant="ghost" onClick={closeModal}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    Guardando...
                  </>
                ) : editingRule ? (
                  'Actualizar Regla'
                ) : (
                  'Crear Regla'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
