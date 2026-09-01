import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../lang/LangProvider';
import {
  useAdmins, useCreateAdmin, usePublications, useSaveSetting, useSiteSettings,
} from '../lib/queries';

const ROLE_NOTE: Record<string, string> = {
  owner: 'Everything, including adding admins',
  editor: 'Channels, plans and publishing',
  support: 'Subscribers and payments',
};

function Admins() {
  const { t } = useLang();
  const { admin } = useAuth();
  const admins = useAdmins();
  const create = useCreateAdmin();
  const [form, setForm] = useState({ email: '', name: '', role: 'editor' });
  const [note, setNote] = useState<string | null>(null);
  const isOwner = admin?.role === 'owner';

  return (
    <section>
      <div className="head">
        <h2 className="head__title" style={{ fontSize: '1rem' }}>{t('ადმინები', 'Admins')}</h2>
        <span className="head__count">{(admins.data ?? []).length}</span>
      </div>

      <div className="panel panel--table">
        <table className="grid">
          <thead>
            <tr><th>{t('სახელი','Name')}</th><th>{t('ელფოსტა','Email')}</th><th>{t('როლი','Role')}</th><th>{t('უფლებები','Can do')}</th></tr>
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
              setNote(t(`მოწვევა გაიგზავნა ${form.email}-ზე.`, `Invite sent to ${form.email}.`));
              setForm({ email: '', name: '', role: 'editor' });
            } catch (err) {
              setNote(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <label className="label">
            <span className="eyebrow">{t('ელფოსტა', 'Email')}</span>
            <input className="field" required type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('სახელი', 'Name')}</span>
            <input className="field" required value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="label">
            <span className="eyebrow">{t('როლი', 'Role')}</span>
            <select className="field" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="editor">editor</option>
              <option value="support">support</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <button type="submit" className="btn btn--signal btn--sm" disabled={create.isPending}>
            {create.isPending ? t('იგზავნება', 'Sending') : t('მოწვევის გაგზავნა', 'Send invite')}
          </button>
          {note && <p className="note" style={{ gridColumn: '1 / -1' }}>{note}</p>}
        </form>
      ) : (
        <p className="note" style={{ marginTop: 10 }}>
          {t('ადმინის დამატება მხოლოდ მფლობელს შეუძლია.', 'Only an owner can add admins.')}
        </p>
      )}
    </section>
  );
}

function Numbers() {
  const { t } = useLang();
  const settings = useSiteSettings();
  const save = useSaveSetting();

  return (
    <section style={{ marginTop: 30 }}>
      <div className="head">
        <h2 className="head__title" style={{ fontSize: '1rem' }}>{t('რიცხვები გვერდზე', 'Numbers on the page')}</h2>
      </div>
      <p className="lede">
        {t('რიცხვები, რომლებსაც საიტი თავის ტექსტში ბეჭდავს. აქ შეცვლა ყველგან აისახება გამოქვეყნების შემდეგ.',
           'Figures the site prints in its own copy. Editing one here changes it everywhere it appears once you publish.')}
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
  const { t } = useLang();
  const pubs = usePublications();
  const rows = pubs.data ?? [];

  return (
    <section style={{ marginTop: 30 }}>
      <div className="head">
        <h2 className="head__title" style={{ fontSize: '1rem' }}>{t('გამოქვეყნების ისტორია', 'Publish history')}</h2>
        <span className="head__count">{t(`ბოლო ${rows.length}`, `last ${rows.length}`)}</span>
      </div>

      <div className="panel">
        {rows.length === 0 ? (
          <p className="notice">
            <span className="state state--standby">{t('არასდროს', 'Never published')}</span>
            {t('საიტი ჯერ კიდევ თან მოყოლილ შიგთავსს აჩვენებს.', 'The live site is still showing the content shipped with it.')}
          </p>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>{t('როდის','When')}</th><th>{t('შიგთავსი','Carried')}</th><th>{t('ანაბეჭდი','Snapshot')}</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><span className="num">
                    {new Date(p.published_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span></td>
                  <td>{t(`${p.channel_count} არხი · ${p.plan_count} პაკეტი`, `${p.channel_count} channels · ${p.plan_count} plans`)}</td>
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
  const { t } = useLang();
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="head">
        <h1 className="head__title">{t('პარამეტრები', 'Settings')}</h1>
      </div>
      <Admins />
      <Numbers />
      <History />
    </div>
  );
}
