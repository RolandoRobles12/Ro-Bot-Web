import { useRef, useState, useEffect, useCallback } from 'react';
import { Image, Video, Music, X, Upload, Loader2, Mic, Camera, StopCircle, Check, Trash2 } from 'lucide-react';
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getBestMimeType(type: 'audio' | 'video'): string {
  if (type === 'audio') {
    // Prefer formats Slack recognizes as audio; webm is last resort (Slack shows it as video)
    for (const mime of ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm']) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return 'audio/webm';
  }
  for (const mime of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'video/webm';
}

function mimeToExt(mime: string): string {
  if (mime.startsWith('audio/ogg')) return 'ogg';
  if (mime.startsWith('audio/mp4')) return 'm4a';
  if (mime.startsWith('audio/webm')) return 'webm';
  if (mime.startsWith('video/mp4')) return 'mp4';
  if (mime.startsWith('video/webm')) return 'webm';
  return 'webm';
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'preview';

export function FileUpload({ workspaceId, value, onChange, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingType, setRecordingType] = useState<'audio' | 'video'>('audio');
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  // Assign stream to video element after it renders
  useEffect(() => {
    if (recordingState === 'recording' && recordingType === 'video' && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
      liveVideoRef.current.muted = true;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [recordingState, recordingType]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = async (type: 'audio' | 'video') => {
    if (disabled) return;
    setRecordingType(type);
    setRecordingState('requesting');
    setRecordingTime(0);
    chunksRef.current = [];

    try {
      const constraints = type === 'audio'
        ? { audio: true }
        : { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = getBestMimeType(type);
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewMime(mimeType);
        setRecordingState('preview');
        stopStream();
      };

      recorder.start(250); // collect chunks every 250ms
      setRecordingState('recording');

      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err: any) {
      setRecordingState('idle');
      stopStream();
      if (err.name === 'NotAllowedError') {
        toast.error('Permiso denegado. Permite el acceso al micrófono/cámara en tu navegador.');
      } else {
        toast.error(err.message || 'No se pudo acceder al dispositivo');
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
  };

  const discardRecording = () => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); }
    setPreviewUrl(null);
    setPreviewMime('');
    setRecordingState('idle');
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const confirmRecording = async () => {
    if (!previewUrl || !previewMime) return;

    const ext = mimeToExt(previewMime);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${recordingType === 'audio' ? 'audio' : 'video'}-${timestamp}.${ext}`;

    const blob = new Blob(chunksRef.current, { type: previewMime });
    const file = new File([blob], filename, { type: previewMime });

    URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewMime('');
    setRecordingState('idle');
    setRecordingTime(0);
    chunksRef.current = [];

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading({ name: file.name, pct: 0 });
    try {
      console.log('[FileUpload] uploadFile start:', file.name, file.type, file.size);
      const attachment = await storageService.uploadAttachment(file, workspaceId, (pct) => {
        setUploading({ name: file.name, pct });
      });
      console.log('[FileUpload] uploadFile success:', attachment);
      onChange([...value, attachment]);
    } catch (err: any) {
      console.error('[FileUpload] uploadFile error:', err);
      toast.error(err.message || 'Error al subir el archivo');
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const detectedType = getAttachmentType(file.type);
    console.log('[FileUpload] handleFiles:', file.name, file.type, '→ type:', detectedType);
    if (!detectedType) {
      toast.error(`Tipo no soportado: ${file.type || file.name}`);
      return;
    }
    await uploadFile(file);
  };

  const handleRemove = async (attachment: MessageAttachment) => {
    onChange(value.filter((a) => a.id !== attachment.id));
    try {
      await storageService.deleteAttachment(attachment.storagePath);
    } catch {
      // Storage cleanup failure is non-critical
    }
  };

  const isRecording = recordingState === 'recording';
  const isRequesting = recordingState === 'requesting';
  const isPreview = recordingState === 'preview';
  const isIdle = recordingState === 'idle';

  return (
    <div className="space-y-3">
      {/* Main dropzone — shown only when idle and not uploading */}
      {isIdle && !uploading && (
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
      )}

      {/* Record buttons — shown only when idle */}
      {isIdle && !uploading && !disabled && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => startRecording('audio')}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-slack-purple hover:text-slack-purple hover:bg-slack-purple/5 transition-colors"
          >
            <Mic className="w-4 h-4" />
            Grabar audio
          </button>
          <button
            type="button"
            onClick={() => startRecording('video')}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-slack-purple hover:text-slack-purple hover:bg-slack-purple/5 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Grabar video
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-900 truncate">{uploading.name}</p>
            <div className="mt-1 h-1.5 bg-blue-200 rounded-full">
              <div className="h-1.5 bg-blue-600 rounded-full transition-all" style={{ width: `${uploading.pct}%` }} />
            </div>
          </div>
          <span className="text-xs text-blue-600 shrink-0">{uploading.pct}%</span>
        </div>
      )}

      {/* Permission request indicator */}
      {isRequesting && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <Loader2 className="w-4 h-4 text-yellow-600 animate-spin shrink-0" />
          <p className="text-sm text-yellow-800">
            Esperando permiso de {recordingType === 'audio' ? 'micrófono' : 'cámara y micrófono'}...
          </p>
        </div>
      )}

      {/* Active recording UI */}
      {isRecording && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-3">
          {/* Live video preview */}
          {recordingType === 'video' && (
            <video
              ref={liveVideoRef}
              className="w-full rounded-lg bg-black aspect-video object-cover"
              autoPlay
              muted
              playsInline
            />
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-700">
                {recordingType === 'audio' ? 'Grabando audio' : 'Grabando video'} — {formatTime(recordingTime)}
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Detener
            </button>
          </div>
        </div>
      )}

      {/* Preview after recording */}
      {isPreview && previewUrl && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Vista previa — {formatTime(recordingTime)}
          </p>
          {previewMime.startsWith('audio') ? (
            <audio src={previewUrl} controls className="w-full" />
          ) : (
            <video src={previewUrl} controls className="w-full rounded-lg aspect-video bg-black" />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmRecording}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slack-purple text-white rounded-lg text-sm hover:bg-slack-purple/90 transition-colors"
            >
              <Check className="w-4 h-4" />
              Usar grabación
            </button>
            <button
              type="button"
              onClick={discardRecording}
              className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Descartar
            </button>
          </div>
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
