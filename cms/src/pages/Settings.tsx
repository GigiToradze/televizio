import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  useAdmins, useCreateAdmin, usePublications, useSaveSetting, useSiteSettings,
} from '../lib/queries';

const ROLE_NOTE: Record<string, string> = {
  owner: 'Everything, including adding admins',
  editor: 'Channels, plans and publishing',
  support: 'Subscribers and payments',
};

function Admins() {
  const { admin } = useAuth();
  const admins = useAdmins();
  const create = useCreateAdmin();
  const [form, setForm] = useState({ email: '', name: '', role: 'editor' });
  const [note, setNote] = useState<string | null>(null);
  const isOwner = admin?.role === 'owner';

  return (
    <section>
      <div className="head">
        <h2 className="head__title" style={{ fontSize: '1rem' }}>Admins</h2>
        <span className="head__count">{(admins.data ?? []).length}</span>
      </div>

      <div className="panel panel--table">
        <table className="grid">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Can do</th></tr>
          </thead>
          <tbody>
            {(admins.data ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td><span className="num">{a.email}</span></td>
                <td><span className="tag tag--primary">{a.role}</span></td>
                <td className="name-ka">{ROLE_NOTE[a.role] ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOwner ? (
        <form
          className="panel invite"
          onSubmit={async (e) => {
            e.preventDefault();
            setNote(null);
            try {
              await create.mutateAsync(form);
              setNote(`Invite sent to ${form.email}.`);
              setForm({ email: '', name: '', role: 'editor' });
            } catch (err) {
              setNote(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <label className="label">
            <span className="eyebrow">Email</span>
            <input className="field" required type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">Name</span>
            <input className="field" required value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">Role</span>
            <select className="field" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="editor">editor</option>
              <option value="support">support</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <button type="submit" className="btn btn--signal btn--sm" disabled={create.isPending}>
            {create.isPending ? 'Sending' : 'Send invite'}
          </button>
          {note && <p className="note" style={{ gridColumn: '1 / -1' }}>{note}</p>}
        </form>
      ) : (
        <p className="note" style={{ marginTop: 10 }}>
          Only an owner can add admins.
        </p>
      )}
    </section>
  );
}

function Numbers() {
  const settings = useSiteSettings();
  const save = useSaveSetting();

  return (
    <section style={{ marginTop: 30 }}>
      <div className="head">
        <h2 className="head__title" style={{ fontSize: '1rem' }}>Numbers on the page</h2>
      </div>
      <p className="lede">
        Figures the site prints in its own copy. Editing one here changes it
        everywhere it appears once you publish.
      </p>

      <div className="panel">
        {(settings.data ?? []).map((s) => (
          <div key={s.key} className="setting">
            <span className="eyebrow setting__key">{s.key.replace(/_/g, ' ')}</span>
            <input
              className="field field--mono setting__value"
              defaultValue={s.value_text ?? ''}
              onBlur={(e) => {
                // "1 024" and "1,000+" are labels; the digits inside them are
                // what the counter animates to, where there are any.
                const digits = e.target.value.replace(/[\s,+]/g, '');
                save.mutate({
                  key: s.key,
                  value_text: e.target.value,
                  value_num: digits !== '' && Number.isFinite(+digits)
                    ? +digits
                    : s.value_num,
                });
              }}
            />
            <span className="note">{s.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function History() {
  const pubs = usePublications();
  const rows = pubs.data ?? [];

  return (
    <section style={{ marginTop: 30 }}>
      <div className="head">
        <h2 className="head__title" style={{ fontSize: '1rem' }}>Publish history</h2>
        <span className="head__count">last {rows.length}</span>
      </div>

      <div className="panel">
        {rows.length === 0 ? (
          <p className="notice">
            <span className="state state--standby">Never published</span>
            The live site is still showing the content shipped with it.
          </p>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>When</th><th>Carried</th><th>Snapshot</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><span className="num">
                    {new Date(p.published_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span></td>
                  <td>{p.channel_count} channels · {p.plan_count} plans</td>
                  <td><span className="num" style={{ color: 'var(--dimmer)' }}>
                    {p.snapshot_hash.slice(0, 12)}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function Settings() {
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="head">
        <h1 className="head__title">Settings</h1>
      </div>
      <Admins />
      <Numbers />
      <History />
    </div>
  );
}
