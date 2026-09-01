import { useLang } from '../lang/LangProvider';

/** Offers the other language, the way the site's own toggle does — the
 *  button says what you would get, not what you already have. */
export default function LangSwitch() {
  const { lang, setLang } = useLang();
  const other = lang === 'ka' ? 'en' : 'ka';

  return (
    <button
      type="button"
      className="lang"
      onClick={() => setLang(other)}
      aria-label={lang === 'ka' ? 'Switch to English' : 'ქართულად გადართვა'}
    >
      <b>{other.toUpperCase()}</b>
    </button>
  );
}
