"use client";

import { Check, Copy, Download, MessageCircle, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useState, useSyncExternalStore } from "react";
import { buttonClasses } from "@/components/ui/primitives";

/**
 * Share a route or search back to Facebook / Messenger, so answers in FB
 * groups can point to Sakay instead of re-typing directions.
 */
export function ShareButtons({ url, title, imageUrl }: { url: string; title: string; imageUrl?: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const encoded = encodeURIComponent(url);
  const canNativeShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${title}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Long-press the link below to copy it.");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      // cancelled
    }
  }

  async function toggleQr() {
    if (qr) return setQr(null);
    try {
      setQr(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
    } catch {
      setError("Couldn't make a QR code. Try copying the link instead.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClasses("secondary", "sm")}>
          {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
          <span aria-hidden className="grid size-4 place-items-center rounded-full bg-[#1877f2] text-[11px] font-bold leading-none text-white">f</span> Facebook
        </a>
        <a href={`fb-messenger://share/?link=${encoded}`} className={buttonClasses("secondary", "sm")}>
          <MessageCircle className="size-4 text-[#0084ff]" aria-hidden /> Messenger
        </a>
        {canNativeShare ? (
          <button type="button" onClick={nativeShare} className={buttonClasses("secondary", "sm")}>
            <Share2 className="size-4" aria-hidden /> More…
          </button>
        ) : null}
        <button type="button" onClick={toggleQr} aria-pressed={Boolean(qr)} className={buttonClasses("secondary", "sm")}>
          <QrCode className="size-4" aria-hidden /> QR
        </button>
        {imageUrl ? (
          <a href={imageUrl} download className={buttonClasses("secondary", "sm")}>
            <Download className="size-4" aria-hidden /> Image
          </a>
        ) : null}
      </div>
      <p className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 select-all">{url}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt={`QR code for ${title}`} width={180} height={180} className="rounded-lg ring-1 ring-slate-200" /> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
