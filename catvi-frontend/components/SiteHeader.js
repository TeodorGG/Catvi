"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Brand() {
  return (
    <span className="brand">
      catvi<span className="brand-dot">.</span>
      <span className="brand-country">MD</span>
    </span>
  );
}
export default function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" aria-label="CATVI, prima pagină">
          <Brand />
        </Link>
        <nav aria-label="Navigație principală">
          {[
            ["/", "Test de viteză"],
            ["/harta", "Date regionale"],
            ["/istoric", "Istoricul meu"],
            ["/despre", "Despre proiect"],
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
        <span className="header-note">
          <span className="tiny-cross">＋</span> Un proiect pentru Moldova
        </span>
      </div>
    </header>
  );
}
