"use client";

import { useState, useMemo } from "react";
import { Search, Smile, Sparkles, Image as ImageIcon, Flame } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Curated WhatsApp Web emoji categories
const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    name: "Sorrisos",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥹", "😊",
      "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙",
      "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎",
      "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁",
      "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨", "😤", "😠",
      "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥",
      "😓", "🤗", "🫡", "🤔", "🫣", "🤫", "🤥", "😶", "😶‍🌫️", "😐"
    ]
  },
  {
    id: "gestures",
    name: "Mãos & Gestos",
    emojis: [
      "👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅",
      "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🫀",
      "🫁", "🧠", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️",
      "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇",
      "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "🫵", "✊", "👊", "🤛"
    ]
  },
  {
    id: "hearts",
    name: "Corações",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
      "💟", "♥️", "💋", "💯", "🔥", "✨", "⭐", "🌟", "💫", "💥"
    ]
  },
  {
    id: "celebration",
    name: "Celebração & Objetos",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "👑", "💎",
      "🚀", "🎯", "💰", "💵", "💸", "💳", "🛒", "🛍️", "📱", "💻",
      "📧", "📅", "🕒", "📍", "📌", "✅", "❌", "⚠️", "🔔", "📢"
    ]
  }
];

// Curated high-quality WhatsApp GIFs
export interface CuratedGif {
  id: string;
  title: string;
  category: "trending" | "reactions" | "applause" | "humor" | "ok";
  url: string;
  previewUrl: string;
}

export const CURATED_GIFS: CuratedGif[] = [
  {
    id: "g1",
    title: "Aplausos / Parabéns",
    category: "applause",
    url: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
    previewUrl: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif"
  },
  {
    id: "g2",
    title: "Comemoração / Yes!",
    category: "reactions",
    url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
    previewUrl: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif"
  },
  {
    id: "g3",
    title: "Mente Explodindo / Wow",
    category: "reactions",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
    previewUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif"
  },
  {
    id: "g4",
    title: "Concordando / Sim",
    category: "ok",
    url: "https://media.giphy.com/media/10Jpr9KSaXLchW/giphy.gif",
    previewUrl: "https://media.giphy.com/media/10Jpr9KSaXLchW/giphy.gif"
  },
  {
    id: "g5",
    title: "Dançando / Festa",
    category: "trending",
    url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
    previewUrl: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif"
  },
  {
    id: "g6",
    title: "Risada / Hilário",
    category: "humor",
    url: "https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif"
  },
  {
    id: "g7",
    title: "Tudo Certo / Like",
    category: "ok",
    url: "https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif",
    previewUrl: "https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif"
  },
  {
    id: "g8",
    title: "Trabalhando Rápido",
    category: "trending",
    url: "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif",
    previewUrl: "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif"
  },
  {
    id: "g9",
    title: "Confuso / Como Assim?",
    category: "reactions",
    url: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif",
    previewUrl: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif"
  },
  {
    id: "g10",
    title: "Obrigado / Gratidão",
    category: "applause",
    url: "https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif"
  },
  {
    id: "g11",
    title: "Piscadinha / De boa",
    category: "ok",
    url: "https://media.giphy.com/media/6t4gwsSh4BQfm/giphy.gif",
    previewUrl: "https://media.giphy.com/media/6t4gwsSh4BQfm/giphy.gif"
  },
  {
    id: "g12",
    title: "Coração / Amor",
    category: "reactions",
    url: "https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif",
    previewUrl: "https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif"
  }
];

export interface WhatsAppEmojiGifPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gif: CuratedGif) => void;
  disabled?: boolean;
}

export function WhatsAppEmojiGifPicker({
  onSelectEmoji,
  onSelectGif,
  disabled = false,
}: WhatsAppEmojiGifPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"emoji" | "gif">("emoji");
  const [search, setSearch] = useState("");

  const filteredGifs = useMemo(() => {
    if (!search.trim()) return CURATED_GIFS;
    const term = search.toLowerCase();
    return CURATED_GIFS.filter(
      (g) =>
        g.title.toLowerCase().includes(term) ||
        g.category.toLowerCase().includes(term)
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        title="Emojis e GIFs"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Smile className="h-5 w-5" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-[340px] sm:w-[380px] p-0 border-border bg-popover shadow-xl rounded-xl overflow-hidden"
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as "emoji" | "gif");
            setSearch("");
          }}
          className="w-full flex flex-col"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/40">
            <TabsList className="h-8 bg-muted/80 p-0.5">
              <TabsTrigger
                value="emoji"
                className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <Smile className="h-3.5 w-3.5" />
                Emojis
              </TabsTrigger>
              <TabsTrigger
                value="gif"
                className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                GIFs
              </TabsTrigger>
            </TabsList>

            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
              WhatsApp
            </span>
          </div>

          {/* EMOJIS TAB */}
          <TabsContent value="emoji" className="m-0 p-2 flex flex-col focus-visible:outline-none">
            <div className="max-h-[280px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="text-[11px] font-medium text-muted-foreground mb-1.5 px-1">
                    {cat.name}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {cat.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onSelectEmoji(emoji);
                        }}
                        className="h-8 w-8 flex items-center justify-center text-xl rounded-md hover:bg-muted transition-transform hover:scale-125 focus:outline-none"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* GIFS TAB */}
          <TabsContent value="gif" className="m-0 p-2 flex flex-col gap-2 focus-visible:outline-none">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar GIFs animados..."
                className="h-8 pl-8 text-xs bg-muted/50 border-border"
              />
            </div>

            <div className="max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredGifs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum GIF encontrado para &quot;{search}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredGifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => {
                        onSelectGif(gif);
                        setOpen(false);
                      }}
                      className="group relative rounded-lg overflow-hidden border border-border/60 bg-muted/40 aspect-[4/3] focus:outline-none hover:border-emerald-500 transition-all text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gif.previewUrl}
                        alt={gif.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white font-medium line-clamp-1">
                          {gif.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
