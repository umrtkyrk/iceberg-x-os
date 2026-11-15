import React, { useEffect, useRef, useState } from 'react';
import { FileText, ImageIcon, Loader2, Paperclip, X, FileType2 } from 'lucide-react';
import { api } from '../utils/api';
import { ATTACHMENTS_ENABLED } from '../config/features';

/**
 * Files on progress updates and demo submissions.
 *
 * AttachmentPicker uploads each chosen file straight away (POST /attachments)
 * and hands the ids to the form, which sends them as `attachment_ids`.
 * AttachmentList shows what was attached. Files are private, so they are
 * fetched with the session token and opened as blob URLs.
 */
export interface AttachmentMeta {
  id: string;
  file_name: string;
  mime_type: string;
  kind: 'image' | 'pdf' | 'docx' | string;
  file_size: number;
}

export const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const KindIcon: React.FC<{ kind: string; className?: string }> = ({ kind, className }) =>
  kind === 'image' ? <ImageIcon className={className} /> : kind === 'pdf' ? <FileText className={className} /> : <FileType2 className={className} />;

interface PendingFile {
  key: string;
  name: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  attachment?: AttachmentMeta;
}

interface AttachmentPickerProps {
  /** Ids of uploaded files, in order. */
  onChange: (ids: string[]) => void;
  /** Bump after the form was sent to clear the list. */
  resetKey?: number;
  /** True while any file is still uploading; the form should wait. */
  onBusyChange?: (busy: boolean) => void;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({ onChange, resetKey = 0, onBusyChange }) => {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setFiles([]), [resetKey]);
  useEffect(() => {
    onChange(files.filter(f => f.status === 'done' && f.attachment).map(f => f.attachment!.id));
    onBusyChange?.(files.some(f => f.status === 'uploading'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  if (!ATTACHMENTS_ENABLED) return null;

  const active = files.filter(f => f.status !== 'error');
  const room = MAX_ATTACHMENTS - active.length;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const chosen = Array.from(list).slice(0, Math.max(0, room));
    for (const file of chosen) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      if (file.size > MAX_BYTES) {
        setFiles(prev => [...prev, { key, name: file.name, status: 'error', error: 'Larger than 15 MB' }]);
        continue;
      }
      setFiles(prev => [...prev, { key, name: file.name, status: 'uploading' }]);
      const form = new FormData();
      form.append('file', file);
      api
        .upload<AttachmentMeta>('/attachments', form)
        .then(attachment => setFiles(prev => prev.map(f => (f.key === key ? { ...f, status: 'done', attachment } : f))))
        .catch((err: any) =>
          setFiles(prev => prev.map(f => (f.key === key ? { ...f, status: 'error', error: err.message || 'Upload failed' } : f)))
        );
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (file: PendingFile) => {
    setFiles(prev => prev.filter(f => f.key !== file.key));
    // Unsent uploads are swept after a day anyway; this just tidies up now.
    if (file.attachment) api.delete(`/attachments/${file.attachment.id}`).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={room <= 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:border-magenta hover:text-magenta disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5" /> Attach files
        </button>
        <span className="text-[11px] font-medium text-gray-400">
          Images, PDF or Word (.docx) · up to {MAX_ATTACHMENTS} files, 15 MB each
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={event => addFiles(event.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map(file => (
            <li
              key={file.key}
              className={`flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
                file.status === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}
            >
              {file.status === 'uploading' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-magenta" />
              ) : (
                <KindIcon kind={file.attachment?.kind || 'docx'} className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              )}
              <span className="max-w-[12rem] truncate" title={file.name}>{file.name}</span>
              {file.attachment && <span className="shrink-0 text-gray-400">{formatBytes(file.attachment.file_size)}</span>}
              {file.error && <span className="shrink-0">· {file.error}</span>}
              <button
                type="button"
                onClick={() => remove(file)}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Opens a private file in a new tab (images, PDF) or downloads it (Word). */
async function openAttachment(attachment: AttachmentMeta) {
  // Open the tab synchronously so pop-up blockers allow it, then point it at the file.
  const tab = attachment.kind === 'docx' ? null : window.open('', '_blank');
  try {
    const { blob } = await api.downloadBlob(`/attachments/${attachment.id}/file`);
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error: any) {
    tab?.close();
    window.alert(error.message || 'Could not open the file.');
  }
}

const Thumbnail: React.FC<{ attachment: AttachmentMeta }> = ({ attachment }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    api
      .downloadBlob(`/attachments/${attachment.id}/file`)
      .then(({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id]);

  return (
    <button
      type="button"
      onClick={() => openAttachment(attachment)}
      title={attachment.file_name}
      className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 transition hover:border-magenta"
    >
      {src ? (
        <img src={src} alt={attachment.file_name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-5 w-5 text-gray-300" />
        </span>
      )}
    </button>
  );
};

export const AttachmentList: React.FC<{ attachments?: AttachmentMeta[] | null; className?: string }> = ({
  attachments,
  className = '',
}) => {
  if (!attachments || attachments.length === 0) return null;
  const images = attachments.filter(a => a.kind === 'image');
  const documents = attachments.filter(a => a.kind !== 'image');

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(image => (
            <Thumbnail key={image.id} attachment={image} />
          ))}
        </div>
      )}
      {documents.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {documents.map(doc => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => openAttachment(doc)}
                className="flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-magenta hover:text-magenta"
              >
                <KindIcon kind={doc.kind} className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="max-w-[14rem] truncate">{doc.file_name}</span>
                <span className="shrink-0 text-gray-400">{formatBytes(doc.file_size)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
