import { useRef, useState } from 'react';
import { useLang } from '../lang/LangProvider';
import { logoUrl, uploadLogo } from '../lib/logos';
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
  const { t } = useLang();
  const save = useSaveChannel();
  const remove = useDeleteChannel();
  const file = useRef<HTMLInputElement>(null);
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

  async function onFile(f: File) {
    setError(null);
    if (!form.slug) {
      setError(t('ჯერ მიუთითე იდენტიფიკატორი — ფაილი მისი სახელით ინახება.',
                 'Give the channel a slug first — the file is named after it.'));
      return;
    }
    setBusy(true);
    try {
      const { path, w, h } = await uploadLogo(f, form.slug);
      setForm((prev) => ({ ...prev, logo_path: path, logo_w: w, logo_h: h }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!catIds.length) {
      setError(t('აირჩიე მინიმუმ ერთი კატეგორია.', 'Pick at least one category.'));
      return;
    }
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

  const url = logoUrl(form.logo_path);

  return (
    <div className="scrim" onClick={onClose}>
      <form className="drawer" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="eyebrow">
            {channel ? t('არხის რედაქტირება', 'Edit channel') : t('ახალი არხი', 'New channel')}
          </p>
          <h2 className="drawer__title">
            {channel ? channel.name_en : t('უსახელო', 'Untitled')}
          </h2>
        </div>

        <label className="label">
          <span className="eyebrow">{t('იდენტიფიკატორი', 'Slug')}</span>
          <input
            className="field field--mono" required value={form.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase().trim())}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="label">
            <span className="eyebrow">{t('სახელი — ქართულად', 'Name — Georgian')}</span>
            <input className="field" required value={form.name_ka}
                   onChange={(e) => set('name_ka', e.target.value)} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('სახელი — ინგლისურად', 'Name — English')}</span>
            <input className="field" required value={form.name_en}
                   onChange={(e) => set('name_en', e.target.value)} />
          </label>
        </div>
        <p className="note">
          {t('თუ ბრენდი არ ითარგმნება — CNN, Discovery — ორივეში ერთი და იგივე ჩაწერე. მაშინ საიტი ერთ სახელს დაბეჭდავს, ორს შორის გადართვის ნაცვლად.',
             'Give both the same value for a brand that is not translated — CNN, Discovery. The site then prints one name instead of switching between two.')}
        </p>

        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>
            {t('კატეგორიები — პირველი ბარათზე იბეჭდება',
               'Categories — the first is printed on the card')}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {categories.map((c) => {
              const at = catIds.indexOf(c.id);
              return (
                <button
                  type="button" key={c.id} onClick={() => toggleCat(c.id)}
                  className={`chip${at === 0 ? ' is-on' : at > 0 ? ' is-sub' : ''}`}
                >
                  {c.slug}{at === 0 ? ' ·' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>
            {t('ლოგო', 'Logo')}
          </span>
          <div className="logo-pick">
            <span className="strip__logo strip__logo--lg">
              {url
                ? <img src={url} alt="" />
                : <span className="state state--fault">{t('არ არის', 'none')}</span>}
            </span>
            <div>
              <input
                ref={file} type="file" hidden
                accept=".png,.svg,.webp,.jpg,.jpeg"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <button type="button" className="btn btn--sm" disabled={busy}
                      onClick={() => file.current?.click()}>
                {busy
                  ? t('იტვირთება', 'Uploading')
                  : url ? t('შეცვლა', 'Replace') : t('ატვირთვა', 'Upload')}
              </button>
              <p className="note" style={{ marginTop: 6 }}>
                {form.logo_path
                  ? <><span className="num">{form.logo_w}×{form.logo_h}</span></>
                  : t('ლოგოს გარეშე გამოქვეყნება არ მოხდება.',
                      'Publishing is refused until there is one.')}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="label">
            <span className="eyebrow">{t('კატალოგის რიგი', 'Catalogue position')}</span>
            <input className="field field--mono" type="number" value={form.sort_order}
                   onChange={(e) => set('sort_order', +e.target.value)} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('ლენტის რიგი', 'Strip position')}</span>
            <input className="field field--mono" type="number" value={form.slider_order}
                   onChange={(e) => set('slider_order', +e.target.value)} />
          </label>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={form.in_slider}
                 onChange={(e) => set('in_slider', e.target.checked)} />
          <span>{t('ჩანს სათაურის ლენტაში', 'Show in the header strip')}</span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={form.is_active}
                 onChange={(e) => set('is_active', e.target.checked)} />
          <span>{t('აქტიური — გამორთული არხები არ ქვეყნდება',
                   'Active — inactive channels are left out of a publish')}</span>
        </label>

        {error && <p className="error">{error}</p>}

        <div className="drawer__foot">
          <button type="submit" className="btn btn--signal btn--sm" disabled={busy}>
            {busy ? t('ინახება', 'Saving') : t('შენახვა', 'Save')}
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            {t('გაუქმება', 'Cancel')}
          </button>
          {channel && (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                if (!confirm(t(`წავშალო ${channel.name_en}? ამის დაბრუნება არ შეიძლება.`,
                               `Delete ${channel.name_en}? This cannot be undone.`))) return;
                await remove.mutateAsync(channel.id);
                onClose();
              }}
            >
              {t('წაშლა', 'Delete')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
