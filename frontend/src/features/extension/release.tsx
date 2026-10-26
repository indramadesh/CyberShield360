import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface Release {
  name: string; version: string; file: string; size_bytes: number;
  sha256: string; build_timestamp: string; permissions: string[];
  chrome_min_version?: string; release_notes?: string[];
}

/** The packaged extension published by `extension/scripts/package.mjs`. */
export function useExtensionRelease() {
  return useQuery({
    queryKey: ["ext-release"],
    queryFn: async () => {
      const r = await fetch("/downloads/release-manifest.json", { cache: "no-store" });
      if (!r.ok) throw new Error("not found");
      return (await r.json()) as Release;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Downloads the extension ZIP directly. Disabled (and says why) if no build exists. */
export function DownloadExtensionButton({ label = "Download Extension", ...props }: ButtonProps & { label?: string }) {
  const rel = useExtensionRelease();
  if (!rel.data) {
    return (
      <Button {...props} disabled title={rel.isLoading ? "Checking for the latest build…" : "No extension build is available yet"}>
        <Download /> {label}
      </Button>
    );
  }
  return (
    <Button {...props} asChild>
      <a href={`/downloads/${rel.data.file}`} download aria-label={`${label} (v${rel.data.version}, ZIP)`}>
        <Download /> {label}
      </a>
    </Button>
  );
}
