"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction } from "@/types";
import {
  Clock,
  Check,
  CheckCheck,
  XCircle,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Download,
  MapPin,
  LayoutTemplate,
  ImageOff,
  CornerDownLeft,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ReplyQuote } from "./reply-quote";
import { MessageReactions } from "./message-reactions";
import { InteractivePreview } from "@/components/interactive/interactive-preview";
import { AudioVoicePlayer } from "./audio-voice-player";
import { useTranslations } from "next-intl";

interface MessageBubbleProps {
  message: Message;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
  contactAvatarUrl?: string | null;
  contactName?: string;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "sending":
      return <Clock className="h-3.5 w-3.5 text-[var(--wa-time-out)] opacity-70" />;
    case "sent":
      return <Check className="h-3.5 w-3.5 text-[var(--wa-time-out)]" />;
    case "delivered":
      return <CheckCheck className="h-3.5 w-3.5 text-[var(--wa-time-out)]" />;
    case "read":
      return <CheckCheck className="h-3.5 w-3.5 text-[var(--wa-check-read)]" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return null;
  }
}

function MediaUnavailable({ label, t }: { label: string, t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <ImageOff className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{t("unavailable", { label })}</span>
    </div>
  );
}

function MediaImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadImage = useCallback(async () => {
    if (!url) return;

    // Proxy URLs need auth fetch to create blob URL
    if (url.startsWith("/api/whatsapp/media/")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load media");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSrc(url);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadImage();
    return () => {
      if (src?.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImage]);

  if (error) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-muted">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-muted">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- Dynamic WhatsApp media blob / presigned CDN URLs */
    <img
      src={src ?? ""}
      alt={alt}
      className="max-h-64 max-w-60 rounded-lg object-cover"
      onError={() => setError(true)}
    />
  );
}

function MessageContent({
  message,
  t,
  isFromMe,
  contactAvatarUrl,
  contactName,
}: {
  message: Message;
  t: ReturnType<typeof useTranslations>;
  isFromMe: boolean;
  contactAvatarUrl?: string | null;
  contactName?: string;
}) {
  switch (message.content_type) {
    case "text":
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content_text}
        </p>
      );

    case "image":
      return (
        <div>
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label={t("photo")} t={t} />
          )}
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "video":
      return (
        <div>
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              className="max-h-64 max-w-60 rounded-lg"
            />
          ) : (
            <MediaUnavailable label={t("video")} t={t} />
          )}
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <AudioVoicePlayer
              src={message.media_url}
              isFromMe={isFromMe}
              avatarUrl={isFromMe ? null : contactAvatarUrl}
              name={isFromMe ? "Eu" : contactName}
            />
          ) : (
            <MediaUnavailable label={t("audio")} t={t} />
          )}
          {message.content_text && (
            <p className="mt-1 text-xs text-muted-foreground/90 italic bg-black/10 dark:bg-white/10 rounded px-2 py-1">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "document": {
      if (!message.media_url) {
        return <MediaUnavailable label={message.content_text || t("document")} t={t} />;
      }

      const fileName = message.content_text || "document";
      const ext = fileName.includes(".")
        ? fileName.split(".").pop()?.toUpperCase() || "DOC"
        : "DOC";

      // Icon & color badge depending on file extension
      let docBadgeColor = "bg-slate-500/20 text-slate-500";
      let DocIcon = FileText;

      if (["PDF"].includes(ext)) {
        docBadgeColor = "bg-red-500/15 text-red-500";
        DocIcon = FileText;
      } else if (["XLS", "XLSX", "CSV"].includes(ext)) {
        docBadgeColor = "bg-emerald-500/15 text-emerald-600";
        DocIcon = FileSpreadsheet;
      } else if (["ZIP", "RAR", "TAR", "7Z"].includes(ext)) {
        docBadgeColor = "bg-amber-500/15 text-amber-600";
        DocIcon = FileArchive;
      } else if (["JSON", "JS", "TS", "HTML", "CSS", "PY"].includes(ext)) {
        docBadgeColor = "bg-blue-500/15 text-blue-500";
        DocIcon = FileCode;
      }

      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 p-3 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group/doc min-w-[220px] max-w-[320px]"
        >
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-bold text-xs uppercase", docBadgeColor)}>
            <DocIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {fileName}
            </p>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {ext}
            </span>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-muted-foreground group-hover/doc:text-foreground transition-colors">
            <Download className="h-4 w-4" />
          </div>
        </a>
      );
    }

    case "template":
      return (
        <div>
          <span className="mb-1 inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <LayoutTemplate className="h-3 w-3" />
            {t("template")}
          </span>
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "location":
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{message.content_text || t("locationShared")}</span>
        </div>
      );

    case "interactive": {
      // Three cases share content_type='interactive':
      //  - OUTBOUND with payload (composer / automation / Flow send after
      //    migration 035): render the buttons/list as they appear on the phone.
      //  - INBOUND tap (customer chose an option, sender_type='customer'):
      //    no payload; show the tapped option's title with a reply affordance
      //    so agents can tell it's a tap, not the customer typing.
      //  - OUTBOUND with NO payload (legacy bot/Flow sends from before
      //    migration 035 backfilled the column): show the body text plainly —
      //    it is our own message, NOT a customer tap.
      if (message.interactive_payload) {
        return <InteractivePreview payload={message.interactive_payload} />;
      }
      if (message.sender_type === "customer") {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <CornerDownLeft className="h-3 w-3" />
              {t("buttonReply")}
            </span>
            <p className="whitespace-pre-wrap break-words text-sm">
              {message.content_text || t("interactiveReply")}
            </p>
          </div>
        );
      }
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content_text || t("interactiveReply")}
        </p>
      );
    }

    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content_text || t("unsupported")}
        </p>
      );
  }
}

export function MessageBubble({
  message,
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
  contactAvatarUrl,
  contactName,
}: MessageBubbleProps) {
  const t = useTranslations("Inbox.bubble");

  const isAgent = message.sender_type === "agent" || message.sender_type === "bot";
  const time = format(new Date(message.created_at), "HH:mm");

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isAgent ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "relative rounded-lg px-3 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] max-w-full group/bubble transition-shadow",
          isAgent
            ? "rounded-tr-none bg-[var(--wa-bubble-out)] text-[var(--wa-bubble-out-text)]"
            : "rounded-tl-none bg-[var(--wa-bubble-in)] text-[var(--wa-bubble-in-text)]",
        )}
      >
        {/* Authentic WhatsApp Bubble Corner Tail SVG */}
        {isAgent ? (
          <span className="absolute -top-[0px] -right-[8px] w-2.5 h-3 overflow-hidden pointer-events-none">
            <svg
              viewBox="0 0 8 13"
              height="13"
              width="8"
              preserveAspectRatio="xMidYMid meet"
              className="fill-[var(--wa-bubble-out)]"
            >
              <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
            </svg>
          </span>
        ) : (
          <span className="absolute -top-[0px] -left-[8px] w-2.5 h-3 overflow-hidden pointer-events-none">
            <svg
              viewBox="0 0 8 13"
              height="13"
              width="8"
              preserveAspectRatio="xMidYMid meet"
              className="fill-[var(--wa-bubble-in)]"
            >
              <path d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
            </svg>
          </span>
        )}

        {reply && (
          <ReplyQuote
            authorLabel={reply.authorLabel}
            preview={reply.preview}
            onPrimary={isAgent}
          />
        )}

        <div className="min-w-0">
          <MessageContent
            message={message}
            t={t}
            isFromMe={isAgent}
            contactAvatarUrl={contactAvatarUrl}
            contactName={contactName}
          />
        </div>

        {/* Floating Bottom-Right Timestamp & Status Checks */}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 select-none pointer-events-none float-right -mb-0.5 ml-3",
          )}
        >
          {message.ai_generated && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-px text-[9px] font-semibold uppercase leading-none tracking-wide text-primary"
              title={t("aiBadgeTitle")}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {t("aiBadge")}
            </span>
          )}
          <span
            className={cn(
              "text-[11px] leading-none tracking-tight font-normal",
              isAgent ? "text-[var(--wa-time-out)]" : "text-[var(--wa-time-in)]",
            )}
          >
            {time}
          </span>
          {isAgent && <StatusIcon status={message.status} />}
        </div>
      </div>

      {reactions && reactions.length > 0 && onToggleReaction && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      )}
    </div>
  );
}
