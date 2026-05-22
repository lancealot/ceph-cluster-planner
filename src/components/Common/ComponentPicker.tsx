import { useMemo } from 'react';
import type { Component, ComponentCategory, ComponentLibrary } from '../../types/components';

interface Props {
  library: ComponentLibrary;
  categories: ComponentCategory[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
}

export function ComponentPicker({ library, categories, value, onChange, placeholder, id }: Props) {
  const options = useMemo(() => {
    const arr: Component[] = [];
    for (const c of Object.values(library)) {
      if (categories.includes(c.category)) arr.push(c);
    }
    arr.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
    return arr;
  }, [library, categories]);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 w-full"
    >
      <option value="">{placeholder ?? '— select —'}</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.vendor} {c.model}
        </option>
      ))}
    </select>
  );
}
