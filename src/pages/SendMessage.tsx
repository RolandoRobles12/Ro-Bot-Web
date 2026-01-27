import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { templateService } from '@/services/firestore';
import { MessageTemplate, MessageRecipient, SenderConfig } from '@/types';
import { Send, User, Hash, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import Select from 'react-select';
import { replaceVariables, validateVariables } from '@/lib/hubspot-variables';

interface SendMessageFormData {
  content: string;
  recipientType: 'channel' | 'user' | 'email';
  recipientValue: string;
  senderType: 'bot' | 'user';
  senderUserId?: string;
}

export function SendMessage() {
  const { selectedWorkspace } = useAppStore();
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SendMessageFormData>({
    defaultValues: {
      senderType: 'bot',
      recipientType: 'channel',
    }
  });

  const senderType = watch('senderType', 'bot');

  useEffect(() => {
    if (!selectedWorkspace) return;

    const unsubscribe = templateService.subscribe(selectedWorkspace.id, (temps) => {
      setTemplates(temps);
    });

    return () => unsubscribe();
  }, [selectedWorkspace]);

  const handleTemplateSelect = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setValue('content', template.content);

    // Initialize variable values
    const initialValues: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialValues[v] = '';
    });
    setVariableValues(initialValues);
  };

  const handleVariableChange = (variable: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [variable]: value }));
  };

  const onSubmit = async (data: SendMessageFormData) => {
    if (!selectedWorkspace || !user) return;

    try {
      setSending(true);

      // Replace variables if any
      let finalContent = data.content;
      if (selectedTemplate && selectedTemplate.variables.length > 0) {
        const validation = validateVariables(data.content, variableValues);
        if (!validation.valid) {
          toast.error(`Variables faltantes: ${validation.missing.join(', ')}`);
          return;
        }
        finalContent = replaceVariables(data.content, variableValues);
      }

      // Prepare recipient
      const recipient: MessageRecipient = {
        type: data.recipientType,
        name: data.recipientValue,
      };

      if (data.recipientType === 'channel') {
        recipient.id = data.recipientValue;
      } else if (data.recipientType === 'email') {
        recipient.email = data.recipientValue;
      }

      // Prepare sender config
      const sender: SenderConfig = {
        type: data.senderType,
      };

      if (data.senderType === 'user' && data.senderUserId) {
        const userToken = selectedWorkspace.userTokens?.find(
          (t) => t.id === data.senderUserId
        );
        if (userToken) {
          sender.userId = userToken.id;
          sender.userName = userToken.userName;
        }
      }

      // Call Firebase Function to send message
      const sendSlackMessage = httpsCallable(functions, 'sendSlackMessage');
      await sendSlackMessage({
        workspaceId: selectedWorkspace.id,
        content: finalContent,
        recipients: [recipient],
        sender,
      });

      toast.success('Mensaje enviado exitosamente');
      setValue('content', '');
      setValue('recipientValue', '');
      setSelectedTemplate(null);
      setVariableValues({});
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  if (!selectedWorkspace) {
    return (
      <div className="text-center py-12">
        <Send className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sin Workspace Seleccionado
        </h2>
        <p className="text-gray-600">
          Por favor selecciona un workspace desde el encabezado para enviar mensajes.
        </p>
      </div>
    );
  }

  const recipientTypeOptions = [
    { value: 'channel', label: 'Canal', icon: Hash },
    { value: 'user', label: 'Usuario', icon: User },
    { value: 'email', label: 'Correo', icon: Mail },
  ];

  const senderOptions = [
    { value: 'bot', label: 'Bot (Predeterminado)', userId: undefined },
    ...(selectedWorkspace.userTokens?.map((token) => ({
      value: 'user',
      label: `${token.userName} (${token.userEmail})${token.isDefault ? ' - Predeterminado' : ''}`,
      userId: token.id,
    })) || []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Enviar Mensaje</h1>
        <p className="text-gray-600 mt-1">
          Envía mensajes instantáneos a canales o usuarios de Slack
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Selector */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Plantillas</CardTitle>
          </CardHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'bg-slack-purple/10 border-slack-purple'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                {template.description && (
                  <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                )}
              </button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay plantillas disponibles
              </p>
            )}
          </div>
        </Card>

        {/* Message Composer */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Componer Mensaje</CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Message Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contenido del Mensaje
              </label>
              <textarea
                {...register('content', { required: 'El contenido del mensaje es requerido' })}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple"
                placeholder="Escribe tu mensaje aquí..."
              />
              {errors.content && (
                <p className="mt-1 text-sm text-slack-red">{errors.content.message}</p>
              )}
            </div>

            {/* Variables */}
            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-blue-900">Completar Variables de Plantilla:</p>
                {selectedTemplate.variables.map((variable) => (
                  <Input
                    key={variable}
                    label={variable}
                    placeholder={`Ingresa valor para ${variable}`}
                    value={variableValues[variable] || ''}
                    onChange={(e) => handleVariableChange(variable, e.target.value)}
                  />
                ))}
              </div>
            )}

            {/* Recipient Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enviar A
              </label>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {recipientTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center justify-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      watch('recipientType') === option.value
                        ? 'bg-slack-purple text-white border-slack-purple'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      {...register('recipientType')}
                      value={option.value}
                      className="sr-only"
                    />
                    <option.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                ))}
              </div>

              <Input
                placeholder={
                  watch('recipientType') === 'channel'
                    ? '#nombre-canal o ID del canal'
                    : watch('recipientType') === 'user'
                    ? '@usuario o ID de usuario'
                    : 'usuario@ejemplo.com'
                }
                {...register('recipientValue', { required: 'El destinatario es requerido' })}
                error={errors.recipientValue?.message}
              />
            </div>

            {/* Sender Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enviar Como
              </label>
              <Select
                options={senderOptions}
                value={senderOptions.find((opt) => {
                  if (senderType === 'bot') return opt.value === 'bot';
                  return opt.userId === watch('senderUserId');
                })}
                onChange={(option) => {
                  if (option?.value === 'bot') {
                    setValue('senderType', 'bot');
                    setValue('senderUserId', undefined);
                  } else {
                    setValue('senderType', 'user');
                    setValue('senderUserId', option?.userId);
                  }
                }}
                className="text-sm"
                classNamePrefix="select"
              />
              <p className="mt-1 text-xs text-gray-500">
                Elige quién enviará el mensaje
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              isLoading={sending}
              disabled={sending}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Mensaje
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
