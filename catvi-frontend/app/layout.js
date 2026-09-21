import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import RegisterSW from "@/components/RegisterSW";
export const metadata = {
  title: {
    default: "CATVI — Internetul Moldovei, măsurat.",
    template: "%s · CATVI",
  },
  description:
    "Măsoară download, upload și latența conexiunii tale. Contribuie opțional la o imagine mai clară a internetului din Republica Moldova.",
  icons: { icon: "/assets/favicon.svg" },
};
export const viewport = { themeColor: "#f5f5f0" };
export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>
        <a className="skip-link" href="#main">
          Sari la conținut
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <RegisterSW />
      </body>
    </html>
  );
}
