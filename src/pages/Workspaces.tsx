import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, MessageSquare, Key, User } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { workspaceService } from '@/services/firestore';
import { SlackWorkspace, UserToken } from '@/types';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';

interface WorkspaceFormData {
  name: string;
  teamId: string;
  teamName: string;
  botToken: string;
  webhookUrl?: string;
}

interface UserTokenFormData {
  userName: string;
  userEmail: string;
  token: string;
  isDefault: boolean;
}

export function Workspaces() {
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<SlackWorkspace | null>(null);
  const [selectedWorkspaceForToken, setSelectedWorkspaceForToken] = useState<SlackWorkspace | null>(null);

  const { register: registerWorkspace, handleSubmit: handleSubmitWorkspace, reset: resetWorkspace, formState: { errors: workspaceErrors } } = useForm<WorkspaceFormData>();
  const { register: registerToken, handleSubmit: handleSubmitToken, reset: resetToken, formState: { errors: tokenErrors } } = useForm<UserTokenFormData>();

  useEffect(() => {
    const unsubscribe = workspaceService.subscribe((ws) => {
      setWorkspaces(ws);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onSubmitWorkspace = async (data: WorkspaceFormData) => {
    try {
      // Build workspace data, omitting empty optional fields
      const workspaceData: any = {
        name: data.name,
        teamId: data.teamId,
        teamName: data.teamName,
        userTokens: editingWorkspace?.userTokens || [],
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only add botToken if provided
      if (data.botToken && data.botToken.trim()) {
        workspaceData.botToken = data.botToken;
      }

      // Only add webhookUrl if provided
      if (data.webhookUrl && data.webhookUrl.trim()) {
        workspaceData.webhookUrl = data.webhookUrl;
      }

      if (editingWorkspace) {
        await workspaceService.update(editingWorkspace.id, workspaceData);
        toast.success('Workspace actualizado exitosamente');
      } else {
        await workspaceService.create(workspaceData);
        toast.success('Workspace creado exitosamente');
      }

      setShowWorkspaceModal(false);
      setEditingWorkspace(null);
      resetWorkspace();
    } catch (error: any) {
      console.error('Error saving workspace:', error);
      toast.error(error.message || 'Error al guardar workspace');
    }
  };

  const onSubmitUserToken = async (data: UserTokenFormData) => {
    if (!selectedWorkspaceForToken) return;

    try {
      const newToken: UserToken = {
        id: `token_${Date.now()}`,
        userId: data.userEmail,
        userName: data.userName,
        userEmail: data.userEmail,
        token: data.token,
        scopes: ['chat:write', 'users:read', 'channels:read'],
        addedAt: Timestamp.now(),
        isDefault: data.isDefault,
      };

      let userTokens = [...(selectedWorkspaceForToken.userTokens || [])];

      // If setting as default, unset other defaults
      if (data.isDefault) {
        userTokens = userTokens.map(t => ({ ...t, isDefault: false }));
      }

      userTokens.push(newToken);

      await workspaceService.update(selectedWorkspaceForToken.id, { userTokens });
      toast.success('Token de usuario agregado exitosamente');

      setShowTokenModal(false);
      setSelectedWorkspaceForToken(null);
      resetToken();
    } catch (error: any) {
      console.error('Error adding user token:', error);
      toast.error(error.message || 'Error al agregar token de usuario');
    }
  };

  const handleEdit = (workspace: SlackWorkspace) => {
    setEditingWorkspace(workspace);
    resetWorkspace({
      name: workspace.name,
      teamId: workspace.teamId,
      teamName: workspace.teamName,
      botToken: workspace.botToken || '',
      webhookUrl: workspace.webhookUrl || '',
    });
    setShowWorkspaceModal(true);
  };

  const handleDelete = async (workspace: SlackWorkspace) => {
    if (!confirm(`¿Estás seguro de eliminar "${workspace.name}"?`)) return;

    try {
      await workspaceService.update(workspace.id, { isActive: false });
      toast.success('Workspace eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      toast.error(error.message || 'Error al eliminar workspace');
    }
  };

  const handleRemoveUserToken = async (workspace: SlackWorkspace, tokenId: string) => {
    if (!confirm('¿Estás seguro de eliminar este token de usuario?')) return;

    try {
      const userTokens = workspace.userTokens.filter(t => t.id !== tokenId);
      await workspaceService.update(workspace.id, { userTokens });
      toast.success('Token de usuario eliminado exitosamente');
    } catch (error: any) {
      console.error('Error removing user token:', error);
      toast.error(error.message || 'Error al eliminar token de usuario');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tus workspaces de Slack y tokens de usuario
          </p>
        </div>
        <Button onClick={() => {
          setEditingWorkspace(null);
          resetWorkspace();
          setShowWorkspaceModal(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Workspace
        </Button>
      </div>

      {/* Workspaces Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
        </div>
      ) : workspaces.length === 0 ? (
        <Card className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Sin Workspaces
          </h2>
          <p className="text-gray-600 mb-4">
            Agrega tu primer workspace de Slack para comenzar
          </p>
          <Button onClick={() => setShowWorkspaceModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Workspace
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {workspaces.map((workspace) => (
            <Card key={workspace.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-slack-purple/10 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-slack-purple" />
                    </div>
                    <div>
                      <CardTitle>{workspace.name}</CardTitle>
                      <p className="text-sm text-gray-500">{workspace.teamName}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(workspace)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(workspace)}>
                      <Trash2 className="w-4 h-4 text-slack-red" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <div className="space-y-3">
                {/* Bot Token */}
                <div className="flex items-center space-x-2 text-sm">
                  <Key className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Token de Bot:</span>
                  <span className="text-gray-900 font-mono">
                    {workspace.botToken ? '••••••••' : 'No configurado'}
                  </span>
                </div>

                {/* User Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Tokens de Usuario:</span>
                      <span className="text-gray-900 font-semibold">
                        {workspace.userTokens?.length || 0}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedWorkspaceForToken(workspace);
                        resetToken();
                        setShowTokenModal(true);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar Token
                    </Button>
                  </div>

                  {workspace.userTokens && workspace.userTokens.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {workspace.userTokens.map((token) => (
                        <div
                          key={token.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {token.userName}
                              {token.isDefault && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                                  Predeterminado
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{token.userEmail}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUserToken(workspace, token.id)}
                          >
                            <Trash2 className="w-3 h-3 text-slack-red" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  Team ID: {workspace.teamId}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Workspace Modal */}
      <Modal
        isOpen={showWorkspaceModal}
        onClose={() => {
          setShowWorkspaceModal(false);
          setEditingWorkspace(null);
          resetWorkspace();
        }}
        title={editingWorkspace ? 'Editar Workspace' : 'Agregar Workspace'}
        size="lg"
      >
        <form onSubmit={handleSubmitWorkspace(onSubmitWorkspace)} className="space-y-4">
          <Input
            label="Nombre del Workspace"
            placeholder="Ej: Equipo de Marketing"
            {...registerWorkspace('name', { required: 'El nombre es requerido' })}
            error={workspaceErrors.name?.message}
          />

          <Input
            label="ID del Equipo"
            placeholder="Ej: T01234567"
            {...registerWorkspace('teamId', { required: 'El ID del equipo es requerido' })}
            error={workspaceErrors.teamId?.message}
            helperText="Encuéntralo en la configuración del workspace de Slack"
          />

          <Input
            label="Nombre del Equipo"
            placeholder="Ej: Workspace de Mi Empresa"
            {...registerWorkspace('teamName', { required: 'El nombre del equipo es requerido' })}
            error={workspaceErrors.teamName?.message}
          />

          <Input
            label="Token de Bot (Opcional)"
            placeholder="xoxb-your-bot-token"
            type="password"
            {...registerWorkspace('botToken')}
            helperText="Token OAuth del Bot de tu App de Slack"
          />

          <Input
            label="URL de Webhook (Opcional)"
            placeholder="https://hooks.slack.com/services/..."
            {...registerWorkspace('webhookUrl')}
            helperText="URL de webhook entrante para mensajes simples"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowWorkspaceModal(false);
                setEditingWorkspace(null);
                resetWorkspace();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {editingWorkspace ? 'Actualizar' : 'Agregar'} Workspace
            </Button>
          </div>
        </form>
      </Modal>

      {/* User Token Modal */}
      <Modal
        isOpen={showTokenModal}
        onClose={() => {
          setShowTokenModal(false);
          setSelectedWorkspaceForToken(null);
          resetToken();
        }}
        title="Agregar Token de Usuario"
        size="lg"
      >
        <form onSubmit={handleSubmitToken(onSubmitUserToken)} className="space-y-4">
          <Input
            label="Nombre de Usuario"
            placeholder="Ej: Juan Pérez"
            {...registerToken('userName', { required: 'El nombre es requerido' })}
            error={tokenErrors.userName?.message}
          />

          <Input
            label="Correo del Usuario"
            type="email"
            placeholder="john@example.com"
            {...registerToken('userEmail', { required: 'El correo es requerido' })}
            error={tokenErrors.userEmail?.message}
          />

          <Input
            label="Token OAuth de Usuario"
            placeholder="xoxp-your-user-token"
            type="password"
            {...registerToken('token', { required: 'El token es requerido' })}
            error={tokenErrors.token?.message}
            helperText="Token OAuth de Usuario del flujo OAuth de Slack"
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              {...registerToken('isDefault')}
              className="w-4 h-4 text-slack-purple border-gray-300 rounded focus:ring-slack-purple"
            />
            <label htmlFor="isDefault" className="text-sm text-gray-700">
              Establecer como remitente predeterminado para este workspace
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowTokenModal(false);
                setSelectedWorkspaceForToken(null);
                resetToken();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">Agregar Token</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
