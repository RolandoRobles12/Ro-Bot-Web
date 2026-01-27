import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Plus, Trash2, Edit2, Power, Calculator, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { ruleService, workspaceService, templateService } from '@/services/firestore';
import { useAuthStore } from '@/store/authStore';
import type {
  MessageRule,
  RuleCondition,
  RuleAction,
  SlackWorkspace,
  MessageTemplate,
  MetricCalculation,
  CalculationType,
} from '@/types';

interface RuleFormData {
  workspaceId: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const CALCULATION_TYPES: { value: CalculationType; label: string; description: string }[] = [
  { value: 'sum', label: 'Sum', description: 'Add multiple values' },
  { value: 'average', label: 'Average', description: 'Calculate average of values' },
  { value: 'divide', label: 'Divide', description: 'Divide first value by second (e.g., conversion rate)' },
  { value: 'multiply', label: 'Multiply', description: 'Multiply values together' },
  { value: 'subtract', label: 'Subtract', description: 'Subtract second value from first' },
  { value: 'count', label: 'Count', description: 'Count number of items' },
];

const HUBSPOT_PROPERTIES = [
  { value: 'dealstage', label: 'Deal Stage', category: 'deal' },
  { value: 'amount', label: 'Deal Amount', category: 'deal' },
  { value: 'closedate', label: 'Close Date', category: 'deal' },
  { value: 'num_associated_contacts', label: 'Number of Contacts', category: 'deal' },
  { value: 'hs_deal_stage_probability', label: 'Deal Probability', category: 'deal' },
  { value: 'email', label: 'Email', category: 'contact' },
  { value: 'firstname', label: 'First Name', category: 'contact' },
  { value: 'lastname', label: 'Last Name', category: 'contact' },
  { value: 'lifecyclestage', label: 'Lifecycle Stage', category: 'contact' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'between', label: 'Between' },
];

export function Rules() {
  const { user } = useAuthStore();
  const [rules, setRules] = useState<MessageRule[]>([]);
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MessageRule | null>(null);
  const [loading, setLoading] = useState(true);

  const { register, control, handleSubmit, reset, watch, setValue } = useForm<RuleFormData>({
    defaultValues: {
      conditions: [{
        type: 'hubspot_property',
        operator: 'equals',
        value: ''
      }],
      actions: [{
        type: 'send_message',
        recipients: []
      }],
    },
  });

  const conditions = watch('conditions');
  const actions = watch('actions');
  const selectedWorkspaceId = watch('workspaceId');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      loadRules(selectedWorkspace);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadTemplates(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const data = await workspaceService.getAll();
      setWorkspaces(data);
      if (data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load workspaces');
      console.error(error);
    }
  };

  const loadRules = async (workspaceId: string) => {
    try {
      setLoading(true);
      const data = await ruleService.getByWorkspace(workspaceId);
      setRules(data);
    } catch (error) {
      toast.error('Failed to load rules');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async (workspaceId: string) => {
    try {
      const data = await templateService.getByWorkspace(workspaceId);
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    reset({
      workspaceId: selectedWorkspace,
      name: '',
      description: '',
      conditions: [{ type: 'hubspot_property', operator: 'equals', value: '' }],
      actions: [{ type: 'send_message', recipients: [] }],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rule: MessageRule) => {
    setEditingRule(rule);
    reset({
      workspaceId: rule.workspaceId,
      name: rule.name,
      description: rule.description || '',
      conditions: rule.conditions,
      actions: rule.actions,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: RuleFormData) => {
    try {
      if (editingRule) {
        await ruleService.update(editingRule.id, {
          ...data,
          updatedAt: Timestamp.now(),
        });
        toast.success('Rule updated successfully');
      } else {
        await ruleService.create({
          ...data,
          isActive: true,
          createdBy: user?.id || 'mock-user-id',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        toast.success('Rule created successfully');
      }
      setIsModalOpen(false);
      loadRules(selectedWorkspace);
    } catch (error) {
      toast.error('Failed to save rule');
      console.error(error);
    }
  };

  const toggleRuleStatus = async (rule: MessageRule) => {
    try {
      await ruleService.update(rule.id, {
        isActive: !rule.isActive,
      });
      toast.success(`Rule ${rule.isActive ? 'disabled' : 'enabled'}`);
      loadRules(selectedWorkspace);
    } catch (error) {
      toast.error('Failed to update rule status');
      console.error(error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await ruleService.delete(ruleId);
      toast.success('Rule deleted successfully');
      loadRules(selectedWorkspace);
    } catch (error) {
      toast.error('Failed to delete rule');
      console.error(error);
    }
  };

  const addCondition = () => {
    const newCondition: RuleCondition = {
      type: 'hubspot_property',
      operator: 'equals',
      value: '',
    };
    setValue('conditions', [...conditions, newCondition]);
  };

  const removeCondition = (index: number) => {
    setValue(
      'conditions',
      conditions.filter((_, i) => i !== index)
    );
  };

  const addAction = () => {
    const newAction: RuleAction = {
      type: 'send_message',
      recipients: [],
    };
    setValue('actions', [...actions, newAction]);
  };

  const removeAction = (index: number) => {
    setValue(
      'actions',
      actions.filter((_, i) => i !== index)
    );
  };

  const updateCondition = (index: number, field: keyof RuleCondition, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setValue('conditions', updated);
  };

  const updateAction = (index: number, field: keyof RuleAction, value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    setValue('actions', updated);
  };

  const updateCalculation = (
    conditionIndex: number,
    field: keyof MetricCalculation,
    value: any
  ) => {
    const updated = [...conditions];
    const calculation = updated[conditionIndex].calculation || {
      type: 'sum' as CalculationType,
      properties: [],
      label: '',
    };
    updated[conditionIndex] = {
      ...updated[conditionIndex],
      calculation: { ...calculation, [field]: value },
    };
    setValue('conditions', updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automation Rules</h1>
          <p className="mt-2 text-gray-600">
            Create performance-based rules with metrics calculations
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2 bg-slack-purple text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Rule</span>
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Workspace
        </label>
        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading rules...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No automation rules yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first rule to automate messages based on performance metrics
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slack-purple text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create First Rule</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {rule.name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        rule.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="mt-1 text-sm text-gray-600">{rule.description}</p>
                  )}

                  <div className="mt-4 space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Conditions:
                      </span>
                      <div className="mt-1 space-y-1">
                        {rule.conditions.map((condition, idx) => (
                          <div
                            key={idx}
                            className="text-sm text-gray-600 flex items-center space-x-2"
                          >
                            {condition.type === 'metric_calculation' &&
                            condition.calculation ? (
                              <>
                                <Calculator className="w-4 h-4 text-slack-purple" />
                                <span>
                                  {condition.calculation.label} (
                                  {condition.calculation.type}) {condition.operator}{' '}
                                  {condition.value}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {condition.property}
                                </span>
                                <span>{condition.operator}</span>
                                <span className="font-medium">{condition.value}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Actions:
                      </span>
                      <div className="mt-1 space-y-1">
                        {rule.actions.map((action, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            {action.type === 'send_message' && (
                              <span>
                                Send message to{' '}
                                {action.recipients?.length || 0} recipient(s)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => toggleRuleStatus(rule)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.isActive
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openEditModal(rule)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit rule"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete rule"
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingRule ? 'Edit Rule' : 'Create New Rule'}
                </h2>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rule Name *
                    </label>
                    <input
                      {...register('name', { required: true })}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="e.g., High Deal Conversion Alert"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      {...register('description')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      placeholder="Describe what this rule does"
                    />
                  </div>

                  <div>
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
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Conditions
                    </h3>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="text-sm text-slack-purple hover:text-opacity-80"
                    >
                      + Add Condition
                    </button>
                  </div>

                  <div className="space-y-4">
                    {conditions.map((condition, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Condition {index + 1}
                          </span>
                          {conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCondition(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">
                              Type
                            </label>
                            <select
                              value={condition.type}
                              onChange={(e) =>
                                updateCondition(index, 'type', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                            >
                              <option value="hubspot_property">
                                HubSpot Property
                              </option>
                              <option value="metric_calculation">
                                Metric Calculation
                              </option>
                              <option value="time_based">Time Based</option>
                            </select>
                          </div>

                          {condition.type === 'metric_calculation' ? (
                            <>
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Calculation Type
                                </label>
                                <select
                                  value={condition.calculation?.type || 'sum'}
                                  onChange={(e) =>
                                    updateCalculation(index, 'type', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                >
                                  {CALCULATION_TYPES.map((calc) => (
                                    <option key={calc.value} value={calc.value}>
                                      {calc.label} - {calc.description}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="col-span-2">
                                <label className="block text-sm text-gray-600 mb-1">
                                  Metric Label
                                </label>
                                <input
                                  type="text"
                                  value={condition.calculation?.label || ''}
                                  onChange={(e) =>
                                    updateCalculation(index, 'label', e.target.value)
                                  }
                                  placeholder="e.g., Deal Conversion Rate"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="block text-sm text-gray-600 mb-1">
                                  HubSpot Properties (comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={condition.calculation?.properties?.join(', ') || ''}
                                  onChange={(e) =>
                                    updateCalculation(
                                      index,
                                      'properties',
                                      e.target.value.split(',').map((s) => s.trim())
                                    )
                                  }
                                  placeholder="e.g., num_deals_closed, num_total_deals"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                Property
                              </label>
                              <select
                                value={condition.property || ''}
                                onChange={(e) =>
                                  updateCondition(index, 'property', e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                              >
                                <option value="">Select property</option>
                                {HUBSPOT_PROPERTIES.map((prop) => (
                                  <option key={prop.value} value={prop.value}>
                                    {prop.label} ({prop.category})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm text-gray-600 mb-1">
                              Operator
                            </label>
                            <select
                              value={condition.operator}
                              onChange={(e) =>
                                updateCondition(index, 'operator', e.target.value)
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
                            <label className="block text-sm text-gray-600 mb-1">
                              Value
                            </label>
                            <input
                              type="text"
                              value={condition.value}
                              onChange={(e) =>
                                updateCondition(index, 'value', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
                    <button
                      type="button"
                      onClick={addAction}
                      className="text-sm text-slack-purple hover:text-opacity-80"
                    >
                      + Add Action
                    </button>
                  </div>

                  <div className="space-y-4">
                    {actions.map((action, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Action {index + 1}
                          </span>
                          {actions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAction(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">
                              Action Type
                            </label>
                            <select
                              value={action.type}
                              onChange={(e) =>
                                updateAction(index, 'type', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                            >
                              <option value="send_message">Send Message</option>
                              <option value="update_hubspot">Update HubSpot</option>
                              <option value="webhook">Call Webhook</option>
                            </select>
                          </div>

                          {action.type === 'send_message' && (
                            <>
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Template
                                </label>
                                <select
                                  value={action.templateId || ''}
                                  onChange={(e) =>
                                    updateAction(index, 'templateId', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                >
                                  <option value="">Select template</option>
                                  {templates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                      {template.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="col-span-2">
                                <label className="block text-sm text-gray-600 mb-1">
                                  Custom Message (overrides template)
                                </label>
                                <textarea
                                  value={action.customMessage || ''}
                                  onChange={(e) =>
                                    updateAction(index, 'customMessage', e.target.value)
                                  }
                                  rows={2}
                                  placeholder="e.g., Conversion rate is {{metric_value}}%"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={action.includeMetrics || false}
                                    onChange={(e) =>
                                      updateAction(
                                        index,
                                        'includeMetrics',
                                        e.target.checked
                                      )
                                    }
                                    className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                                  />
                                  <span className="text-sm text-gray-700">
                                    Include calculated metrics in message
                                  </span>
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slack-purple text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
