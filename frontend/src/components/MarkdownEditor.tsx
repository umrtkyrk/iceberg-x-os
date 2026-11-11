import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bold, Italic, Heading3, List, Code, Link as LinkIcon, Eye, Edit3, ImagePlus, Loader2, X } from 'lucide-react';
import { MentionTextarea } from './MentionTextarea';
import { MentionAwareLink, decodeMentions, encodeMentions, type MentionMap } from '../utils/mentions';
import { FORUM_IMAGE_TYPES, ForumImage, imageParts, isForumImage, joinImages, splitImages } from '../utils/forumImages';
import { getAssetUrl } from '../utils/assets';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  maxLength?: number;
  /** Typing "@" suggests people; mentioned names show in pink. */
  mentions?: boolean;
  /** Enables the image button and pasting images; returns the Markdown to insert. */
  onUploadImage?: (file: File) => Promise<string>;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value: storedValue,
  onChange: onStoredChange,
  placeholder = '',
  rows = 4,
  required = false,
  disabled = false,
  id,
  maxLength,
  mentions = false,
  onUploadImage
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // With images on, attached images are kept at the end of the stored body and shown as thumbnails
  // under the text, so the textarea never contains their Markdown.
  const { text: storedText, images } = onUploadImage ? splitImages(storedValue) : { text: storedValue, images: [] as string[] };
  // With mentions on, the textarea shows "@Name" while the stored body keeps "[@Name](@handle)".
  const known = useRef<MentionMap>(new Map());
  const value = mentions ? decodeMentions(storedText, known.current) : storedText;
  const [lengthError, setLengthError] = useState('');
  // Validates the complete proposed body; a person's message is never shortened to fit.
  const commit = (text: string, nextImages: string[]) => {
    const next = joinImages(mentions ? encodeMentions(text, known.current) : text, nextImages);
    if (maxLength !== undefined && next.length > maxLength) {
      // A picker registers the proposed name before calling onChange. Roll it back too.
      known.current = new Map();
      if (mentions) decodeMentions(storedText, known.current);
      setLengthError(`This edit exceeds the ${maxLength.toLocaleString('en-US')}-character limit including mention links and images. Your previous text is unchanged. Shorten the message before trying again.`);
      return false;
    }
    setLengthError('');
    onStoredChange(next);
    return true;
  };
  const onChange = (text: string) => commit(text, images);
  const fileInput = useRef<HTMLInputElement>(null);
  // An upload that finishes later must see images attached or removed in the meantime.
  const latestImages = useRef(images);
  latestImages.current = images;
  const removeImage = (index: number) => { commit(value, images.filter((_, i) => i !== index)); textareaRef.current?.focus(); };
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const addImage = async (file: File) => {
    const textarea = textareaRef.current;
    if (!onUploadImage || uploading) return;
    setUploading(true); setUploadError('');
    try {
      const markdown = await onUploadImage(file);
      // Read the text again: the person may have kept typing during the upload.
      const text = textareaRef.current?.value ?? value;
      const caret = textarea ? [textarea.selectionStart, textarea.selectionEnd] as const : null;
      if (!commit(text, [...latestImages.current, markdown])) return;
      setTimeout(() => { if (!textarea || !caret) return; textarea.focus(); textarea.setSelectionRange(caret[0], caret[1]); }, 0);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The image could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = onUploadImage ? Array.from(event.clipboardData.files).find(item => item.type.startsWith('image/')) : undefined;
    if (!file) return;
    event.preventDefault();
    void addImage(file);
  };

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    
    const replacement = before + (selectedText || 'text') + after;
    const newValue = text.substring(0, start) + replacement + text.substring(end);
    
    if (!onChange(newValue)) return;

    // Keep focus and select inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + (selectedText || 'text').length
      );
    }, 0);
  };

  return (
    <div className="markdown-editor w-full border border-gray-100 rounded-xl overflow-hidden bg-white shadow-subtle flex flex-col focus-within:border-magenta focus-within:ring-1 focus-within:ring-magenta/20 transition-all">
      {/* Editor Toolbar Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-3.5 py-1.5 flex items-center justify-between gap-4 flex-wrap">
        
        {/* Formatting Actions (only visible in write tab) */}
        <div className={`flex items-center gap-1 transition-opacity duration-200 ${activeTab === 'write' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <button
            type="button"
            onClick={() => insertMarkdown('**', '**')}
            disabled={disabled}
            className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
            title="Bold (**text**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          
          <button
            type="button"
            onClick={() => insertMarkdown('*', '*')}
            disabled={disabled}
            className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
            title="Italic (*text*)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => insertMarkdown('### ', '')}
            disabled={disabled}
            className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
            title="Heading (### text)"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1"></div>

          <button
            type="button"
            onClick={() => insertMarkdown('- ', '')}
            disabled={disabled}
            className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
            title="List (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => insertMarkdown('`', '`')}
            disabled={disabled}
            className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
            title="Inline Code (`code`)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => insertMarkdown('[', '](url)')}
            disabled={disabled}
            className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
            title="Link ([text](url))"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>

          {onUploadImage && <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={disabled || uploading}
              className="p-1.5 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-900 transition-colors"
              title="Add image (PNG, JPEG, WEBP or GIF, up to 5 MB). You can also paste one."
              aria-label="Add image"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={FORUM_IMAGE_TYPES}
              className="hidden"
              onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void addImage(file); }}
            />
          </>}
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-200/60 p-0.5 rounded-lg text-xs font-bold text-gray-600 self-end">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
              activeTab === 'write'
                ? 'bg-white text-magenta shadow-sm'
                : 'hover:text-gray-900'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Write</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
              activeTab === 'preview'
                ? 'bg-white text-magenta shadow-sm'
                : 'hover:text-gray-900'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {(uploading || uploadError) && <p role="status" className={`px-3.5 py-1.5 text-[11px] font-semibold border-b border-gray-100 ${uploadError ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'}`}>{uploadError || 'Uploading image…'}</p>}
      {lengthError && <p role="alert" className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50">{lengthError}</p>}

      {/* Editor Body */}
      <div className="relative min-h-[140px] bg-white flex flex-col">
        {activeTab === 'write' && mentions ? (
          <MentionTextarea
            ref={textareaRef}
            id={id}
            required={required && !images.length}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            mentionNames={[...known.current.keys()]}
            onMention={(name, handle) => known.current.set(name, handle)}
            onPaste={handlePaste}
            disabled={disabled}
            className="w-full h-full min-h-[140px] p-4 outline-none resize-y text-xs font-semibold text-gray-800 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none"
          />
        ) : activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            id={id}
            required={required && !images.length}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            disabled={disabled}
            className="w-full h-full min-h-[140px] p-4 outline-none resize-y text-xs font-semibold text-gray-800 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none"
          />
        ) : (
          <div className="w-full h-full min-h-[140px] p-4 overflow-y-auto max-h-[400px] border-0 select-text">
            {value.trim() ? (
              <div className="markdown markdown-body text-xs font-semibold text-gray-800">
                <ReactMarkdown skipHtml components={{ ...(mentions ? { a: MentionAwareLink } : {}), ...(onUploadImage ? { img: ForumImage } : {}) }}>{storedValue}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-400 text-xs italic">Nothing to preview. Start typing in the Write tab.</p>
            )}
          </div>
        )}
      </div>
      {(images.length > 0 || uploading) && <ul className="markdown-editor-attachments flex flex-wrap gap-2 px-3.5 py-2.5 border-t border-gray-100 bg-gray-50" aria-label="Attached images">
        {images.map((markdown, index) => {
          const image = imageParts(markdown);
          const src = image && isForumImage(image.src) ? getAssetUrl(image.src) || image.src : '';
          const label = image?.alt || `Image ${index + 1}`;
          return <li key={`${index}-${markdown}`} className="relative">
            {src ? <img src={src} alt={label} className="h-20 w-20 rounded-lg border border-gray-200 bg-white object-cover"/> : <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-white p-1 text-center text-[10px] text-gray-500 break-all">{label}</span>}
            <button type="button" onClick={() => removeImage(index)} disabled={disabled} aria-label={`Remove image: ${label}`} title="Remove image"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white shadow hover:bg-magenta">
              <X className="h-3 w-3"/>
            </button>
          </li>;
        })}
        {uploading && <li className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white" aria-label="Uploading image"><Loader2 className="h-4 w-4 animate-spin text-gray-400"/></li>}
      </ul>}
    </div>
  );
};
