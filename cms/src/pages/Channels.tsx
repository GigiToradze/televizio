import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useCategories, useChannels, type ChannelRecord } from '../lib/queries';
import ChannelDrawer from './ChannelDrawer';

export default function Channels() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const categories = useCategories();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ChannelRecord | 'new' | null>(null);

  if (channels.isLoading || categories.isLoading) {
    return <p className="eyebrow">Loading</p>;
  }
  if (channels.error) return <p className="error">{String(channels.error)}</p>;

  const bySlug = new Map((categories.data ?? []).map((c) => [c.id, c.slug]));
  const all = channels.data ?? [];
  const term = query.trim().toLowerCase();
  const rows = all.filter((c) =>
    !term ||
    c.slug.includes(term) ||
    c.name_en.toLowerCase().includes(term) ||
    c.name_ka.includes(query.trim()));

  return (
    <section>
      <div className="head">
        <h1 className="head__title">Channels</h1>
        <span className="head__count">
          {rows.length === all.length ? all.length : `${rows.length} of ${all.length}`}
        </span>
        <div className="head__right">
          <input
            className="field field--mono" style={{ width: 190 }}
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
          />
          {editable && (
            <button className="btn btn--signal btn--sm" onClick={() => setEditing('new')}>
              Add channel
            </button>
          )}
        </div>
      </div>

      <div className="panel panel--table">
        <table className="grid">
          <thead>
            <tr>
              <th className="pos">#</th>
              <th>Channel</th>
              <th>Slug</th>
              <th>Categories</th>
              <th>Logo</th>
              <th>Strip</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const cats = [...c.channel_categories]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((cc) => bySlug.get(cc.category_id))
                .filter(Boolean) as string[];
              const noLogo = !c.logo_path || !c.logo_w || !c.logo_h;

              return (
                <tr
                  key={c.id}
                  className={editable ? 'is-clickable' : undefined}
                  onClick={() => editable && setEditing(c)}
                >
                  <td className="pos">{String(c.sort_order).padStart(2, '0')}</td>
                  <td>
                    {c.name_en}
                    {c.name_ka !== c.name_en && (
                      <span className="name-ka"> {c.name_ka}</span>
                    )}
                  </td>
                  <td><span className="num">{c.slug}</span></td>
                  <td>
                    {cats.map((s, i) => (
                      <span key={s} className={`tag${i === 0 ? ' tag--primary' : ''}`}>
                        {s}
                      </span>
                    ))}
                  </td>
                  <td>
                    {noLogo
                      ? <span className="state state--fault">no logo</span>
                      : <span className="num">{c.logo_w}×{c.logo_h}</span>}
                  </td>
                  <td>
                    {c.in_slider
                      ? <span className="num">{String(c.slider_order).padStart(2, '0')}</span>
                      : <span className="state state--ok">—</span>}
                  </td>
                  <td>
                    {c.is_active
                      ? <span className="state state--ok">live</span>
                      : <span className="state state--standby">off</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="notice">
            <span className="state state--ok">Nothing found</span>
            No channel matches “{query}”.
          </p>
        )}
      </div>

      {editing && (
        <ChannelDrawer
          channel={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
