import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'ka' | 'en';

/* The CMS speaks the same two languages the site does, and shares its
   preference: the key is the one main.js already writes, so switching in
   one place is remembered in the other. */
const KEY = 'televizio-lang';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Georgian first, English second — the order the site's markup uses. */
  t: (ka: string, en: string) => string;
};

const LangCtx = createContext<Ctx | null>(null);

function stored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'ka' || v === 'en') return v;
  } catch { /* private mode, or storage disabled */ }
  return 'ka';
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(stored);

  // data-lang on the root is what the stylesheet reads to decide whether a
  // label may be set in capitals. Mkhedruli has none, so Georgian never is.
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }

  const value: Ctx = {
    lang,
    setLang,
    t: (ka, en) => (lang === 'ka' ? ka : en),
  };

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error('useLang outside LangProvider');
  return ctx;
}
