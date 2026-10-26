import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { UploadCloud, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Drag-and-drop image picker with type/size validation, preview and remove. */
export function FileDrop({
  file, onFile, maxMb = 10, accept = DEFAULT_TYPES, title = "Upload an image or screenshot",
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  maxMb?: number;
  accept?: string[];
  title?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined | null) {
    setError("");
    if (!f) return;
    if (!accept.includes(f.type)) { setError("Unsupported file type. Use PNG, JPEG or WebP."); return; }
    if (f.size > maxMb * 1024 * 1024) { setError(`File is larger than ${maxMb} MB.`); return; }
    onFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    pick(e.dataTransfer.files?.[0]);
  }

  if (file && preview) {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-background-2 p-3">
        <img src={preview} alt="Selected file preview" className="size-20 rounded-lg border object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{file.name}</div>
          <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · {file.type.replace("image/", "").toUpperCase()}</div>
        </div>
        <button type="button" onClick={() => onFile(null)}
          className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground hover:border-danger/50 hover:text-danger"
          aria-label="Remove file">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-9 text-center transition-colors",
          drag ? "border-primary bg-primary/5" : "border-input bg-background-2 hover:border-primary/60",
        )}
        aria-label={`${title}. Drop a file or press Enter to choose one.`}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/12 text-primary">
          {drag ? <ImageIcon className="size-5" /> : <UploadCloud className="size-5" />}
        </span>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">Drag &amp; drop or click to choose · PNG, JPEG, WebP · max {maxMb} MB</span>
      </div>
      <input ref={input} type="file" accept={accept.join(",")} className="sr-only"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} tabIndex={-1} aria-hidden />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
