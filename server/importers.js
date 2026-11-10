import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Tags the editor understands. Anything else is stripped before it is stored. */
const ALLOWED = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr',
  ],
  allowedAttributes: {},
};

export function cleanHtml(html) {
  return sanitizeHtml(String(html ?? ''), ALLOWED);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Plain text -> paragraphs (blank lines split paragraphs, single newlines become <br>). */
export function textToHtml(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Convert an uploaded file into sanitized editor HTML.
 * @returns {Promise<{ title: string, html: string }>}
 */
export async function fileToDocument(originalName, buffer) {
  const match = /^(.*?)(\.[^.]+)?$/.exec(originalName || 'Untitled');
  const base = (match[1] || 'Untitled').trim().slice(0, 200) || 'Untitled';
  const ext = (match[2] || '').toLowerCase();

  let html;
  if (ext === '.txt') {
    html = textToHtml(buffer.toString('utf8'));
  } else if (ext === '.md') {
    html = await marked.parse(buffer.toString('utf8'));
  } else if (ext === '.docx') {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } else {
    const err = new Error(`Unsupported file type "${ext || 'none'}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
    err.status = 415;
    throw err;
  }
  return { title: base, html: cleanHtml(html) };
}
