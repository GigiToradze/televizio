import { useState } from 'react';
import { uploadLogo } from '../lib/logos';
import {
  useDeleteChannel, useSaveChannel,
  type CategoryRecord, type ChannelRecord,
} from '../lib/queries';

const BLANK = {
  slug: '', name_ka: '', name_en: '',
  logo_path: null as string | null, logo_w: null as number | null,
  logo_h: null as number | null,
  sort_order: 0, in_slider: false, slider_order: 0, is_active: true,
};

export default function ChannelDrawer({
  channel, categories, onClose,
}: {
  channel: ChannelRecord | null;
  categories: CategoryRecord[];
  onClose: () => void;
}) {
  const save = useSaveChannel();
  const remove = useDeleteChannel();
  const [form, setForm] = useState(channel ? { ...channel } : { ...BLANK });
  const [catIds, setCatIds] = useState<string[]>(
    channel
      ? [...channel.channel_categories]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) => c.category_id)
      : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Clicking a category toggles it; the first one selected stays first, and
   *  that is the label printed on the channel's card. */
  function toggleCat(id: string) {
    setCatIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  async function onFile(file: File) {
    setError(null);
    if (!form.slug) {
      setError('Give the channel a slug first — the file is named after it.');
      return;
    }
    setBusy(true);
    try {
      const { path, w, h } = await uploadLogo(file, form.slug);
      setForm((f) => ({ ...f, logo_path: path, logo_w: w, logo_h: h }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!catIds.length) { setError('Pick at least one category.'); return; }
    setBusy(true);
    try {
      const { channel_categories: _drop, ...row } = form as typeof form &
        { channel_categories?: unknown };
      await save.mutateAsync({ ...row, categoryIds: catIds });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ' +
                'ring-neutral-800 focus:outline-none focus:ring-red-600';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="h-full w-[28rem] space-y-4 overflow-y-auto border-l
                   border-neutral-800 bg-neutral-950 p-6"
      >
        <h2 className="text-lg font-semibold">
          {channel ? `Edit ${channel.name_en}` : 'New channel'}
        </h2>

        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">Slug</span>
          <input className={field} required value={form.slug}
                 onChange={(e) => set('slug', e.target.value.toLowerCase().trim())} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Name (Georgian)</span>
            <input className={field} required value={form.name_ka}
                   onChange={(e) => set('name_ka', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Name (English)</span>
            <input className={field} required value={form.name_en}
                   onChange={(e) => set('name_en', e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-neutral-600">
          Give both the same value for a brand that is not translated — CNN, Discovery.
          The site then prints one name instead of switching between two.
        </p>

        <div className="space-y-1">
          <span className="text-xs text-neutral-500">
            Categories — the first is printed on the card
          </span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const at = catIds.indexOf(c.id);
              return (
                <button
                  type="button" key={c.id} onClick={() => toggleCat(c.id)}
                  className={`rounded px-2 py-1 text-xs ring-1 ${
                    at === 0 ? 'bg-red-600 ring-red-600'
                    : at > 0 ? 'bg-neutral-800 ring-neutral-700'
                    : 'ring-neutral-800 text-neutral-400'}`}
                >
                  {c.name_en}{at === 0 ? ' · tag' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-neutral-500">Logo</span>
          <input
            type="file" accept=".png,.svg,.webp,.jpg,.jpeg"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="block w-full text-sm text-neutral-400"
          />
          <p className="text-xs text-neutral-600">
            {form.logo_path
              ? `${form.logo_path} · ${form.logo_w}×${form.logo_h}`
              : 'No logo yet — a publish will refuse until there is one.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Order</span>
            <input className={field} type="number" value={form.sort_order}
                   onChange={(e) => set('sort_order', +e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Slider pos.</span>
            <input className={field} type="number" value={form.slider_order}
                   onChange={(e) => set('slider_order', +e.target.value)} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={form.in_slider}
                   onChange={(e) => set('in_slider', e.target.checked)} />
            In slider
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active}
                 onChange={(e) => set('is_active', e.target.checked)} />
          Active — inactive channels are left out of a publish
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-medium
                             disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose}
                  className="rounded px-3 py-2 text-sm text-neutral-400">
            Cancel
          </button>
          {channel && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Delete ${channel.name_en}? This cannot be undone.`)) return;
                await remove.mutateAsync(channel.id);
                onClose();
              }}
              className="ml-auto rounded px-3 py-2 text-sm text-red-500"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
