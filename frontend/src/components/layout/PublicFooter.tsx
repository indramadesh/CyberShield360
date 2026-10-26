import { Logo } from "@/components/brand/Logo";
import { GatedExternal, GatedLink } from "@/features/auth/gate";

const REPO = "https://github.com/indramadesh/CyberShield360";

const COLS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  { title: "Product", links: [
    { label: "Scan & Analyze", to: "/app/scan" },
    { label: "Browser Protection", to: "/browser-protection" },
    { label: "Learning Hub", to: "/app/learn" },
    { label: "News & Updates", to: "/app/news" },
  ] },
  { title: "Help", links: [
    { label: "I think I was scammed", to: "/app/incident" },
    { label: "About", to: "/about" },
    { label: "Contact", to: "/contact" },
  ] },
  { title: "Transparency", links: [
    { label: "Extension privacy policy", href: `${REPO}/blob/main/extension/PRIVACY_POLICY.md` },
    { label: "Security & threat model", href: `${REPO}/blob/main/docs/THREAT_MODEL.md` },
    { label: "Source code", href: REPO },
  ] },
];

export function PublicFooter() {
  return (
    <footer className="border-t bg-background-2/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Investigate suspicious links, messages and images, and make safer decisions online.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <GatedLink to={l.to} className="text-muted-foreground hover:text-primary">{l.label}</GatedLink>
                  ) : (
                    <GatedExternal href={l.href!} className="text-muted-foreground hover:text-primary">{l.label}</GatedExternal>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-subtle sm:px-6">
          CyberShield360 provides assessments, not guarantees — always verify through official channels. Not legal advice.
        </p>
      </div>
    </footer>
  );
}
