import { useRef, useState } from 'react';
import { Image, Video, Music, X, Upload, Loader2 } from 'lucide-react';
import { MessageAttachment } from '@/types';
import { storageService, ACCEPTED_MIME_TYPES, getAttachmentType } from '@/services/storageService';
import { toast } from 'sonner';

interface FileUploadProps {
  workspaceId: string;
  value: MessageAttachment[];
  onChange: (attachments: MessageAttachment[]) => void;
  disabled?: boolean;
}

const TYPE_ICON: Record<MessageAttachment['type'], typeof Image> = {
  image: Image,
  video: Video,
  audio: Music,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ workspaceId, value, onChange, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!getAttachmentType(file.type)) {
      toast.error(`Tipo no soportado: ${file.type || file.name}`);
      return;
    }

    setUploading({ name: file.name, pct: 0 });
    try {
      const attachment = await storageService.uploadAttachment(file, workspaceId, (pct) => {
        setUploading({ name: file.name, pct });
      });
      onChange([...value, attachment]);
    } catch (err: any) {
      toast.error(err.message || 'Error al subir el archivo');
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (attachment: MessageAttachment) => {
    onChange(value.filter((a) => a.id !== attachment.id));
    try {
      await storageService.deleteAttachment(attachment.storagePath);
    } catch {
      // Storage cleanup failure is non-critical
    }
  };

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging ? 'border-slack-purple bg-slack-purple/5' : 'border-gray-300 hover:border-slack-purple'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          Arrastra un archivo o <span className="text-slack-purple font-medium">haz clic</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">Imágenes, videos y audios · Máx. 50 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-900 truncate">{uploading.name}</p>
            <div className="mt-1 h-1.5 bg-blue-200 rounded-full">
              <div
                className="h-1.5 bg-blue-600 rounded-full transition-all"
                style={{ width: `${uploading.pct}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-blue-600 shrink-0">{uploading.pct}%</span>
        </div>
      )}

      {/* Attachment list */}
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((attachment) => {
            const Icon = TYPE_ICON[attachment.type];
            return (
              <li
                key={attachment.id}
                className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              >
                <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{attachment.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(attachment.size)}</p>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(attachment)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
