function Btn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function currentBlock(editor) {
  for (const level of [1, 2, 3]) if (editor.isActive('heading', { level })) return `h${level}`;
  return 'p';
}

export default function Toolbar({ editor }) {
  if (!editor) return null;
  const chain = () => editor.chain().focus();

  function setBlock(value) {
    if (value === 'p') chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(value.slice(1)) }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn title="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!editor.can().undo()}>↶</Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={() => chain().redo().run()} disabled={!editor.can().redo()}>↷</Btn>
      <span className="tb-sep" />
      <select className="tb-select" value={currentBlock(editor)} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="tb-sep" />
      <Btn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><s>S</s></Btn>
      <span className="tb-sep" />
      <Btn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>• List</Btn>
      <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>1. List</Btn>
      <Btn title="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>❝</Btn>
      <Btn title="Code block" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}>{'</>'}</Btn>
      <Btn title="Horizontal line" onClick={() => chain().setHorizontalRule().run()}>―</Btn>
      <span className="tb-sep" />
      <Btn title="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>⌫ Format</Btn>
    </div>
  );
}
