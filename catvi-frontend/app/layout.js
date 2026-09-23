import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import RegisterSW from "@/components/RegisterSW";
import Providers from "@/components/Providers";
export const metadata = {
  title: {
    default: "CATVI — Internetul Moldovei, măsurat.",
    template: "%s · CATVI",
  },
  description:
    "Măsoară download, upload și latența conexiunii tale. Contribuie opțional la o imagine mai clară a internetului din Republica Moldova.",
  icons: { icon: "/assets/favicon.svg" },
};
export const viewport = { themeColor: "#0B0714" };
export default function RootLayout({ children }) {
  return (
    <html lang="ro" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <a className="skip-link" href="#main">
            Sari la conținut
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
          <RegisterSW />
        </Providers>
      </body>
    </html>
  );
}
