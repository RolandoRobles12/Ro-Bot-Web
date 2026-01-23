import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { templateService } from '@/services/firestore';
import { MessageTemplate } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { extractVariables, ALL_HUBSPOT_VARIABLES } from '@/lib/hubspot-variables';
import { useForm } from 'react-hook-form';

interface TemplateFormData {
  name: string;
  description: string;
  content: string;
  category: string;
}

export function Templates() {
  const { selectedWorkspace } = useAppStore();
  const { user, isEditor } = useAuthStore();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TemplateFormData>();

  const contentValue = watch('content', '');
  const detectedVariables = extractVariables(contentValue);

  useEffect(() => {
    if (!selectedWorkspace) return;

    const unsubscribe = templateService.subscribe(selectedWorkspace.id, (temps) => {
      setTemplates(temps);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedWorkspace]);

  const onSubmit = async (data: TemplateFormData) => {
    if (!selectedWorkspace || !user) return;

    try {
      const variables = extractVariables(data.content);
      const hubspotVariables = ALL_HUBSPOT_VARIABLES.filter((v) =>
        variables.includes(v.name)
      );

      const templateData = {
        workspaceId: selectedWorkspace.id,
        name: data.name,
        description: data.description,
        content: data.content,
        variables,
        hubspotVariables,
        category: data.category || 'general',
        isActive: true,
        createdBy: user.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (editingTemplate) {
        await templateService.update(editingTemplate.id, templateData);
        toast.success('Template updated successfully!');
      } else {
        await templateService.create(templateData as any);
        toast.success('Template created successfully!');
      }

      setShowModal(false);
      setEditingTemplate(null);
      reset();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    }
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    reset({
      name: template.name,
      description: template.description || '',
      content: template.content,
      category: template.category || 'general',
    });
    setShowModal(true);
  };

  const handleDelete = async (template: MessageTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      await templateService.update(template.id, { isActive: false });
      toast.success('Template deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const handleDuplicate = async (template: MessageTemplate) => {
    if (!user) return;

    try {
      await templateService.create({
        ...template,
        name: `${template.name} (Copy)`,
        createdBy: user.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as any);
      toast.success('Template duplicated successfully!');
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      toast.error(error.message || 'Failed to duplicate template');
    }
  };

  if (!selectedWorkspace) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          No Workspace Selected
        </h2>
        <p className="text-gray-600">
          Please select a workspace from the header to view templates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600 mt-1">
            Create and manage message templates with HubSpot variables
          </p>
        </div>
        {isEditor() && (
          <Button
            onClick={() => {
              setEditingTemplate(null);
              reset({ name: '', description: '', content: '', category: 'general' });
              setShowModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
        </div>
      ) : templates.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Templates Yet
          </h2>
          <p className="text-gray-600 mb-4">
            Create your first template to get started
          </p>
          {isEditor() && (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  )}
                </div>
                {template.category && (
                  <span className="px-2 py-1 text-xs bg-slack-purple/10 text-slack-purple rounded-full">
                    {template.category}
                  </span>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-700 line-clamp-3">{template.content}</p>
              </div>

              {template.variables.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Variables:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.map((variable) => (
                      <span
                        key={variable}
                        className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {`{${variable}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 mb-3">
                Created {format(template.createdAt.toDate(), 'MMM dd, yyyy')}
              </div>

              {isEditor() && (
                <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(template)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="w-4 h-4 text-slack-red" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Template Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTemplate(null);
          reset();
        }}
        title={editingTemplate ? 'Edit Template' : 'Create Template'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Template Name"
            placeholder="e.g., Welcome Message"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief description of this template"
            {...register('description')}
          />

          <Input
            label="Category (Optional)"
            placeholder="e.g., onboarding, alerts, reminders"
            {...register('category')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Content
            </label>
            <textarea
              {...register('content', { required: 'Content is required' })}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple"
              placeholder="Hi {{contact.firstname}}, welcome to our platform!"
            />
            {errors.content && (
              <p className="mt-1 text-sm text-slack-red">{errors.content.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Use {'{{variable}}'} syntax for HubSpot variables. Example: {'{{contact.firstname}}'}
            </p>
          </div>

          {detectedVariables.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Detected Variables ({detectedVariables.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((variable) => (
                  <span
                    key={variable}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowModal(false);
                setEditingTemplate(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
