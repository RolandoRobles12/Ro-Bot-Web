import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { MessageAttachment } from '@/types';

const ACCEPTED_TYPES: Record<MessageAttachment['type'], string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/webm'],
};

export function getAttachmentType(mimeType: string): MessageAttachment['type'] | null {
  // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm")
  const baseMime = mimeType.split(';')[0].trim();
  for (const [type, mimes] of Object.entries(ACCEPTED_TYPES)) {
    if (mimes.includes(baseMime)) return type as MessageAttachment['type'];
  }
  return null;
}

export const ACCEPTED_MIME_TYPES = Object.values(ACCEPTED_TYPES).flat().join(',');
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const storageService = {
  uploadAttachment(
    file: File,
    workspaceId: string,
    onProgress?: (pct: number) => void
  ): Promise<MessageAttachment> {
    return new Promise((resolve, reject) => {
      const type = getAttachmentType(file.type);
      if (!type) {
        reject(new Error(`Tipo de archivo no soportado: ${file.type}`));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`El archivo excede el límite de 50 MB`));
        return;
      }

      const id = crypto.randomUUID();
      const ext = file.name.split('.').pop() || '';
      const storagePath = `workspaces/${workspaceId}/attachments/${id}${ext ? `.${ext}` : ''}`;
      const storageRef = ref(storage, storagePath);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        'state_changed',
        (snapshot) => {
          onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        reject,
        async () => {
          try {
            const storageUrl = await getDownloadURL(task.snapshot.ref);
            resolve({ id, name: file.name, type, mimeType: file.type, storageUrl, storagePath, size: file.size });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  },

  async deleteAttachment(storagePath: string): Promise<void> {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  },
};
