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
   *  that is the label printed on the channel's card on the site. */
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

  return (
    <div className="scrim" onClick={onClose}>
      <form className="drawer" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="eyebrow">{channel ? 'Edit channel' : 'New channel'}</p>
          <h2 className="drawer__title">{channel ? channel.name_en : 'Untitled'}</h2>
        </div>

        <label className="label">
          <span className="eyebrow">Slug</span>
          <input
            className="field field--mono" required value={form.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase().trim())}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="label">
            <span className="eyebrow">Name — Georgian</span>
            <input className="field" required value={form.name_ka}
                   onChange={(e) => set('name_ka', e.target.value)} />
          </label>
          <label className="label">
            <span className="eyebrow">Name — English</span>
            <input className="field" required value={form.name_en}
                   onChange={(e) => set('name_en', e.target.value)} />
          </label>
        </div>
        <p className="note">
          Give both the same value for a brand that is not translated — CNN,
          Discovery. The site then prints one name instead of switching between two.
        </p>

        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>
            Categories — the first is printed on the card
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {categories.map((c) => {
              const at = catIds.indexOf(c.id);
              return (
                <button
                  type="button" key={c.id} onClick={() => toggleCat(c.id)}
                  className={`chip${at === 0 ? ' is-on' : at > 0 ? ' is-sub' : ''}`}
                >
                  {c.slug}{at === 0 ? ' · tag' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>
            Logo
          </span>
          <input
            type="file" accept=".png,.svg,.webp,.jpg,.jpeg"
            className="note"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <p className="note" style={{ marginTop: 6 }}>
            {form.logo_path
              ? <><span className="num">{form.logo_w}×{form.logo_h}</span> · {form.logo_path}</>
              : 'No logo yet. Publishing is refused until there is one.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="label">
            <span className="eyebrow">Catalogue position</span>
            <input className="field field--mono" type="number" value={form.sort_order}
                   onChange={(e) => set('sort_order', +e.target.value)} />
          </label>
          <label className="label">
            <span className="eyebrow">Strip position</span>
            <input className="field field--mono" type="number" value={form.slider_order}
                   onChange={(e) => set('slider_order', +e.target.value)} />
          </label>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={form.in_slider}
                 onChange={(e) => set('in_slider', e.target.checked)} />
          <span>Show in the header strip</span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={form.is_active}
                 onChange={(e) => set('is_active', e.target.checked)} />
          <span>Active — inactive channels are left out of a publish</span>
        </label>

        {error && <p className="error">{error}</p>}

        <div className="drawer__foot">
          <button type="submit" className="btn btn--signal btn--sm" disabled={busy}>
            {busy ? 'Saving' : 'Save'}
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Cancel
          </button>
          {channel && (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                if (!confirm(`Delete ${channel.name_en}? This cannot be undone.`)) return;
                await remove.mutateAsync(channel.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
