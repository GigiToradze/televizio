import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useLang } from '../lang/LangProvider';
import { useChannels, useSaveChannelLogo, useSaveSliderOrder } from '../lib/queries';
import { logoUrl, uploadLogo } from '../lib/logos';

type Row = {
  id: string; slug: string; name_en: string; in_slider: boolean;
  logo_path: string | null; logo_w: number | null; logo_h: number | null;
};

/** One row of the strip: its artwork, whether it is in, and where.
 *
 *  The logo lives here as well as in the channel editor because this is the
 *  screen where you are looking at the strip as a strip — noticing that one
 *  mark is missing or wrong is the whole point of the view. */
function StripRow({
  row, index, position, editable, onToggle, onMove,
}: {
  row: Row; index: number; position: number | null; editable: boolean;
  onToggle: (checked: boolean) => void;
  onMove: (to: number) => void;
}) {
  const { t } = useLang();
  const saveLogo = useSaveChannelLogo();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(f: File) {
    setError(null);
    setBusy(true);
    try {
      const { path, w, h } = await uploadLogo(f, row.slug);
      await saveLogo.mutateAsync({ id: row.id, logo_path: path, logo_w: w, logo_h: h });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const url = logoUrl(row.logo_path);

  return (
    <li className={`strip__row${row.in_slider ? '' : ' is-out'}`}>
      <span className="pos">{position === null ? '—' : String(position).padStart(2, '0')}</span>

      <span className="strip__logo">
        {url
          ? <img src={url} alt="" width={row.logo_w ?? undefined}
                 height={row.logo_h ?? undefined} loading="lazy" />
          : <span className="state state--fault">{t('ლოგო არ არის', 'no logo')}</span>}
      </span>

      <label className="toggle strip__name">
        <input
          type="checkbox" checked={row.in_slider} disabled={!editable}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>{row.name_en}</span>
      </label>

      {editable && (
        <span className="strip__acts">
          <input
            ref={file} type="file" hidden
            accept=".png,.svg,.webp,.jpg,.jpeg"
            onChange={(e) => e.target.files?.[0] && accept(e.target.files[0])}
          />
          <button className="btn btn--quiet btn--sm" type="button" disabled={busy}
                  onClick={() => file.current?.click()}>
            {busy ? t('იტვირთება', 'Uploading') : t('ლოგო', 'Logo')}
          </button>
          <button className="btn btn--quiet btn--sm" type="button"
                  onClick={() => onMove(index - 1)}
                  aria-label={`Move ${row.name_en} up`}>↑</button>
          <button className="btn btn--quiet btn--sm" type="button"
                  onClick={() => onMove(index + 1)}
                  aria-label={`Move ${row.name_en} down`}>↓</button>
        </span>
      )}

      {error && <p className="error strip__error">{error}</p>}
    </li>
  );
}

/** The strip is a curated subset in its own order — Imedi leads it while
 *  First Channel leads the catalogue — so it gets a screen of its own
 *  rather than a column in the channels table. */
export default function Slider() {
  const { admin } = useAuth();
  const { t } = useLang();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const save = useSaveSliderOrder();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!channels.data) return;
    setRows(
      [...channels.data]
        .sort((a, b) => {
          if (a.in_slider !== b.in_slider) return a.in_slider ? -1 : 1;
          return a.slider_order - b.slider_order;
        })
        .map((c) => ({
          id: c.id, slug: c.slug, name_en: c.name_en, in_slider: c.in_slider,
          logo_path: c.logo_path, logo_w: c.logo_w, logo_h: c.logo_h,
        })),
    );
    setDirty(false);
  }, [channels.data]);

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setRows(next);
    setDirty(true);
  }

  async function commit() {
    // Position counts only the channels actually in the strip, from one, so
    // the numbers read the way the marquee does.
    let position = 0;
    await save.mutateAsync(rows.map((r) => ({
      id: r.id,
      in_slider: r.in_slider,
      slider_order: r.in_slider ? ++position : 0,
    })));
    setDirty(false);
  }

  if (channels.isLoading) return <p className="eyebrow">{t('იტვირთება', 'Loading')}</p>;

  const inStrip = rows.filter((r) => r.in_slider).length;
  const missing = rows.filter((r) => r.in_slider && !r.logo_path).length;

  return (
    <section style={{ maxWidth: 720 }}>
      <div className="head">
        <h1 className="head__title">{t('სლაიდერი', 'Slider')}</h1>
        <span className="head__count">
          {t(`${inStrip} ლენტაში`, `${inStrip} in the strip`)}
          {missing > 0 && (
            <span className="state state--fault">
              {' · '}{t(`${missing} ლოგოს გარეშე`, `${missing} without a logo`)}
            </span>
          )}
        </span>
        {editable && (
          <div className="head__right">
            <button
              className={`btn btn--sm${dirty ? ' btn--signal' : ''}`}
              onClick={commit} disabled={save.isPending || !dirty}
            >
              {save.isPending
                ? t('ინახება', 'Saving')
                : dirty ? t('რიგის შენახვა', 'Save order') : t('შენახულია', 'Saved')}
            </button>
          </div>
        )}
      </div>

      <p className="lede">
        {t('ლოგოები, რომლებიც საიტის თავში მიცურავს — იმ რიგით, როგორც ჩანს. მონიშვნის მოხსნა არხს კატალოგში ტოვებს, ლენტიდან კი იღებს. ლოგოს ატვირთვა აქვე შეიძლება.',
           'The logos that scroll across the top of the site, in the order they appear. Unticking a channel leaves it in the catalogue but takes it out of the strip. Logos can be uploaded here too.')}
      </p>

      <ol className="panel strip">
        {rows.map((r, i) => (
          <StripRow
            key={r.id} row={r} index={i} editable={editable}
            position={r.in_slider
              ? rows.slice(0, i + 1).filter((x) => x.in_slider).length
              : null}
            onToggle={(checked) => {
              const next = [...rows];
              next[i] = { ...r, in_slider: checked };
              setRows(next);
              setDirty(true);
            }}
            onMove={(to) => move(i, to)}
          />
        ))}
      </ol>
    </section>
  );
}
