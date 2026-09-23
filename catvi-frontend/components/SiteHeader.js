"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M18 2 L6 18h9l-3 12 14-18h-9l3-12z"
            fill="var(--blue)"
            stroke="var(--blue-glow)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      catvi<span className="brand-dot">.</span>
      <span className="brand-country">md</span>
    </span>
  );
}

function ThemeIcon({ theme }) {
  return theme === "dark" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export default function SiteHeader() {
  const path = usePathname();
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" aria-label="CATVI, prima pagină">
          <Brand />
        </Link>
        <nav aria-label="Navigație principală">
          {[
            ["/", t("navHome")],
            ["/harta", t("navMap")],
            ["/istoric", t("navHistory")],
            ["/despre", t("navAbout")],
          ].map(([href, text]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              {text}
            </Link>
          ))}
        </nav>
        <div className="header-controls">
          <span className="header-note">
            <span className="tiny-cross">＋</span> {t("headerNote")}
          </span>
          <div className="lang-select">
            {["ro", "ru", "en"].map((code) => (
              <button
                key={code}
                className={lang === code ? "active" : ""}
                onClick={() => setLang(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="theme-toggle" aria-label="Comută tema" onClick={toggleTheme}>
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </div>
    </header>
  );
}
