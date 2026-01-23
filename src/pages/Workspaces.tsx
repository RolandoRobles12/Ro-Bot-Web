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
        toast.success('Workspace updated successfully!');
      } else {
        await workspaceService.create(workspaceData);
        toast.success('Workspace created successfully!');
      }

      setShowWorkspaceModal(false);
      setEditingWorkspace(null);
      resetWorkspace();
    } catch (error: any) {
      console.error('Error saving workspace:', error);
      toast.error(error.message || 'Failed to save workspace');
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
      toast.success('User token added successfully!');

      setShowTokenModal(false);
      setSelectedWorkspaceForToken(null);
      resetToken();
    } catch (error: any) {
      console.error('Error adding user token:', error);
      toast.error(error.message || 'Failed to add user token');
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
    if (!confirm(`Are you sure you want to delete "${workspace.name}"?`)) return;

    try {
      await workspaceService.update(workspace.id, { isActive: false });
      toast.success('Workspace deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      toast.error(error.message || 'Failed to delete workspace');
    }
  };

  const handleRemoveUserToken = async (workspace: SlackWorkspace, tokenId: string) => {
    if (!confirm('Are you sure you want to remove this user token?')) return;

    try {
      const userTokens = workspace.userTokens.filter(t => t.id !== tokenId);
      await workspaceService.update(workspace.id, { userTokens });
      toast.success('User token removed successfully!');
    } catch (error: any) {
      console.error('Error removing user token:', error);
      toast.error(error.message || 'Failed to remove user token');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-gray-600 mt-1">
            Manage your Slack workspaces and user tokens
          </p>
        </div>
        <Button onClick={() => {
          setEditingWorkspace(null);
          resetWorkspace();
          setShowWorkspaceModal(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Workspace
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
            No Workspaces Yet
          </h2>
          <p className="text-gray-600 mb-4">
            Add your first Slack workspace to get started
          </p>
          <Button onClick={() => setShowWorkspaceModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Workspace
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
                  <span className="text-gray-600">Bot Token:</span>
                  <span className="text-gray-900 font-mono">
                    {workspace.botToken ? '••••••••' : 'Not configured'}
                  </span>
                </div>

                {/* User Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">User Tokens:</span>
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
                      Add Token
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
                                  Default
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
        title={editingWorkspace ? 'Edit Workspace' : 'Add Workspace'}
        size="lg"
      >
        <form onSubmit={handleSubmitWorkspace(onSubmitWorkspace)} className="space-y-4">
          <Input
            label="Workspace Name"
            placeholder="e.g., Marketing Team"
            {...registerWorkspace('name', { required: 'Name is required' })}
            error={workspaceErrors.name?.message}
          />

          <Input
            label="Team ID"
            placeholder="e.g., T01234567"
            {...registerWorkspace('teamId', { required: 'Team ID is required' })}
            error={workspaceErrors.teamId?.message}
            helperText="Find this in Slack workspace settings"
          />

          <Input
            label="Team Name"
            placeholder="e.g., My Company Workspace"
            {...registerWorkspace('teamName', { required: 'Team name is required' })}
            error={workspaceErrors.teamName?.message}
          />

          <Input
            label="Bot Token (Optional)"
            placeholder="xoxb-your-bot-token"
            type="password"
            {...registerWorkspace('botToken')}
            helperText="Bot User OAuth Token from your Slack App"
          />

          <Input
            label="Webhook URL (Optional)"
            placeholder="https://hooks.slack.com/services/..."
            {...registerWorkspace('webhookUrl')}
            helperText="Incoming webhook URL for simple messages"
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
              Cancel
            </Button>
            <Button type="submit">
              {editingWorkspace ? 'Update' : 'Add'} Workspace
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
        title="Add User Token"
        size="lg"
      >
        <form onSubmit={handleSubmitToken(onSubmitUserToken)} className="space-y-4">
          <Input
            label="User Name"
            placeholder="e.g., John Doe"
            {...registerToken('userName', { required: 'User name is required' })}
            error={tokenErrors.userName?.message}
          />

          <Input
            label="User Email"
            type="email"
            placeholder="john@example.com"
            {...registerToken('userEmail', { required: 'Email is required' })}
            error={tokenErrors.userEmail?.message}
          />

          <Input
            label="User OAuth Token"
            placeholder="xoxp-your-user-token"
            type="password"
            {...registerToken('token', { required: 'Token is required' })}
            error={tokenErrors.token?.message}
            helperText="User OAuth Token from Slack OAuth flow"
          />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              {...registerToken('isDefault')}
              className="w-4 h-4 text-slack-purple border-gray-300 rounded focus:ring-slack-purple"
            />
            <label htmlFor="isDefault" className="text-sm text-gray-700">
              Set as default sender for this workspace
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
              Cancel
            </Button>
            <Button type="submit">Add Token</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
