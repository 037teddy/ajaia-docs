import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '../api.js';
import Toolbar from './Toolbar.jsx';
import ShareDialog from './ShareDialog.jsx';

const AUTOSAVE_MS = 800;

const STATUS_TEXT = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes…',
  saving: 'Saving…',
};

/** Loads the document, then hands it to the editor body once we know its content and the user's role. */
export default function DocEditor({ id }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDoc(id).then((d) => setDoc(d.document)).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <main className="center">
        <div className="card">
          <p className="error">{error}</p>
          <a className="btn" href="#/">Back to documents</a>
        </div>
      </main>
    );
  }
  if (!doc) return <main className="center muted">Loading document…</main>;
  return <EditorBody initial={doc} />;
}

function EditorBody({ initial }) {
  const canEdit = initial.role !== 'viewer';
  const isOwner = initial.role === 'owner';

  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState('saved');
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(null); // latest server copy when a save is rejected as stale
  const [shareOpen, setShareOpen] = useState(false);

  const version = useRef(initial.version);
  const titleRef = useRef(initial.title);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef(null);
  const editorRef = useRef(null);
  const blocked = useRef(false); // stop autosaving while a conflict is unresolved

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    const editor = editorRef.current;
    if (!editor || !dirty.current || blocked.current) return;
    if (inFlight.current) { timer.current = setTimeout(save, AUTOSAVE_MS); return; }

    const t = titleRef.current.trim();
    if (!t) { setStatus('unsaved'); setSaveError('Title cannot be empty'); return; }

    inFlight.current = true;
    dirty.current = false;
    setStatus('saving');
    try {
      const { document } = await api.saveDoc(initial.id, { title: t, content: editor.getHTML(), version: version.current });
      version.current = document.version;
      setSaveError('');
      setStatus(dirty.current ? 'unsaved' : 'saved');
    } catch (err) {
      if (err.status === 409) {
        blocked.current = true;
        setConflict(err.body.document);
      } else {
        dirty.current = true;
        setSaveError(err.message);
      }
      setStatus('unsaved');
    } finally {
      inFlight.current = false;
      if (dirty.current && !blocked.current) timer.current = setTimeout(save, AUTOSAVE_MS * 2);
    }
  }, [initial.id]);

  const markDirty = useCallback(() => {
    dirty.current = true;
    setStatus('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_MS);
  }, [save]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: canEdit ? 'Start typing…' : '' }),
    ],
    content: initial.content,
    editable: canEdit,
    onUpdate: markDirty,
  });
  editorRef.current = editor;

  // Ctrl/Cmd+S saves immediately; warn before leaving with unsaved changes; flush on unmount.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    const onUnload = (e) => {
      if (dirty.current || inFlight.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
      save();
    };
  }, [save]);

  function onTitleChange(e) {
    setTitle(e.target.value);
    titleRef.current = e.target.value;
    markDirty();
  }

  function loadLatest() {
    editor.commands.setContent(conflict.content, false);
    setTitle(conflict.title);
    titleRef.current = conflict.title;
    version.current = conflict.version;
    dirty.current = false;
    blocked.current = false;
    setConflict(null);
    setStatus('saved');
  }

  return (
    <main className="editor-page">
      <div className="doc-header">
        <a href="#/" className="btn ghost" title="Back to documents">←</a>
        <input
          className="title-input"
          value={title}
          onChange={onTitleChange}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={save}
          disabled={!canEdit}
          maxLength={200}
          aria-label="Document title"
        />
        <span className={`save-status ${saveError ? 'error-text' : ''}`} aria-live="polite">
          {canEdit ? (saveError ? `Not saved: ${saveError}` : STATUS_TEXT[status]) : ''}
        </span>
        <div className="doc-header-right">
          {!isOwner && (
            <span className="pill" title={`Owned by ${initial.owner.email}`}>
              {initial.owner.name}'s doc · {canEdit ? 'Can edit' : 'View only'}
            </span>
          )}
          {isOwner && <button className="btn primary" onClick={() => setShareOpen(true)}>Share</button>}
        </div>
      </div>

      {conflict && (
        <div className="banner warn" role="alert">
          Someone else saved this document while you were editing. Your latest changes were not saved.
          <button className="btn small" onClick={loadLatest}>Load latest version</button>
        </div>
      )}
      {!canEdit && <div className="banner">You have view-only access. Ask {initial.owner.name} for edit access.</div>}

      {canEdit && <Toolbar editor={editor} />}
      <div className="page">
        <EditorContent editor={editor} className="prose" />
      </div>

      {shareOpen && <ShareDialog docId={initial.id} onClose={() => setShareOpen(false)} />}
    </main>
  );
}
