import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "starting" | "scanning" | "denied" | "notfound" | "unsupported" | "error";

/** Camera QR scanner. Decoding happens entirely in the browser (via jsQR) —
 *  only the decoded text is ever sent to the server. Requires a secure context
 *  (works on http://localhost and on HTTPS). */
export function QrScanner({ onDecoded }: { onDecoded: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState("");

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
    if (code && code.data) {
      stop();
      onDecoded(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onDecoded, stop]);

  const start = useCallback(async () => {
    setDetail("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setStatus("scanning");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setStatus("notfound");
      else { setStatus("error"); setDetail((err as Error)?.message ?? ""); }
    }
  }, [tick]);

  // Auto-start on mount; always release the camera on unmount.
  useEffect(() => {
    void start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message: Record<Status, string> = {
    idle: "",
    starting: "Requesting camera…",
    scanning: "Point your camera at a QR code.",
    denied: "Camera permission was denied. Allow camera access in your browser, or use Paste / Upload below.",
    notfound: "No camera was found on this device. Use Paste or Upload instead.",
    unsupported: "This browser can't access the camera here. Camera needs HTTPS or localhost — use Paste or Upload instead.",
    error: `Could not start the camera${detail ? ` (${detail})` : ""}. Use Paste or Upload instead.`,
  };

  const problem = status === "denied" || status === "notfound" || status === "unsupported" || status === "error";

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border bg-black">
        {/* The live camera preview. */}
        <video ref={videoRef} className="h-full w-full object-cover" muted aria-label="Camera preview" />
        <canvas ref={canvasRef} className="hidden" />
        {/* Scanning reticle */}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-2/3 rounded-lg border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {status !== "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/80">
            {problem ? <CameraOff className="size-6" /> : <Camera className="size-6 animate-pulse" />}
            <span className="max-w-xs">{message[status] || "Starting camera…"}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {status === "scanning"
            ? "Decoding happens in your browser — only the decoded text is sent."
            : message[status]}
        </p>
        {problem && (
          <Button variant="outline" size="sm" onClick={() => void start()}>
            <RefreshCw className="size-4" /> Retry camera
          </Button>
        )}
      </div>
    </div>
  );
}
