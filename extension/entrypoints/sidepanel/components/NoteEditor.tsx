import { useState, useEffect } from 'preact/hooks';

interface NoteEditorProps {
  note: string;
  onSave: (note: string) => void;
}

export function NoteEditor({ note, onSave }: NoteEditorProps) {
  const [value, setValue] = useState(note);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(note);
    setDirty(false);
  }, [note]);

  function handleChange(e: Event) {
    const text = (e.target as HTMLTextAreaElement).value;
    setValue(text);
    setDirty(text !== note);
  }

  function handleSave() {
    onSave(value);
    setDirty(false);
  }

  return (
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">Notes</label>
      <textarea
        value={value}
        onInput={handleChange}
        placeholder="Add a note about this step..."
        class="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md resize-y min-h-[60px] focus:outline-none focus:ring-1 focus:ring-blue-400"
        rows={3}
      />
      {dirty && (
        <button
          onClick={handleSave}
          class="mt-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
        >
          Save Note
        </button>
      )}
    </div>
  );
}
