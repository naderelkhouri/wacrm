"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Search, User, Phone, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/types";

interface NewConversationDialogProps {
  onSuccess: (conversationId: string) => void;
  trigger?: React.ReactNode;
}

export function NewConversationDialog({
  onSuccess,
  trigger,
}: NewConversationDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // New contact fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Initial message
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch("/api/contacts?limit=50");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch {
      // Fallback direct Supabase
      const supabase = createClient();
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .order("name", { ascending: true })
        .limit(50);
      if (data) setContacts(data as Contact[]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchContacts();
    } else {
      setSelectedContact(null);
      setMessage("");
      setSearch("");
      setNewName("");
      setNewPhone("");
      setMode("existing");
    }
  }, [open, fetchContacts]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  }, [contacts, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      toast.error("Digite uma mensagem inicial para iniciar a conversa.");
      return;
    }

    setSubmitting(true);
    try {
      let targetContactId = selectedContact?.id;

      if (mode === "new") {
        const cleanPhone = newPhone.trim();
        if (!cleanPhone) {
          toast.error("O número de telefone é obrigatório.");
          setSubmitting(false);
          return;
        }

        const createRes = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName.trim() || undefined,
            phone: cleanPhone,
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao criar contato.");
        }

        const contactData = await createRes.json();
        targetContactId = contactData.contact?.id;
      }

      if (!targetContactId) {
        toast.error("Selecione ou crie um contato primeiro.");
        setSubmitting(false);
        return;
      }

      // Send the first message to find-or-create the conversation
      const sendRes = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: targetContactId,
          message_type: "text",
          content_text: trimmedMsg,
        }),
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        throw new Error(sendData.error || "Falha ao enviar mensagem.");
      }

      toast.success("Conversa iniciada com sucesso!");
      setOpen(false);
      if (sendData.conversation_id) {
        onSuccess(sendData.conversation_id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            />
          }
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Nova Conversa</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md border-border bg-card p-6 text-foreground sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            Iniciar Nova Conversa
          </DialogTitle>
        </DialogHeader>

        {/* Mode Selector Tabs */}
        <div className="mt-3 flex rounded-lg bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              mode === "existing"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Contato Existente
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              mode === "new"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Novo Número
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === "existing" ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Buscar contato
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome ou telefone..."
                  className="h-9 border-border bg-muted pl-8 text-xs placeholder:text-muted-foreground"
                />
              </div>

              {/* Contact list selection */}
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-1 divide-y divide-border/50">
                {loadingContacts ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                    Carregando contatos...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Nenhum contato encontrado.
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = selectedContact?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedContact(c)}
                        className={`flex w-full items-center justify-between p-2 text-left text-xs transition-colors rounded-md ${
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="truncate">
                            {c.name || "Sem nome"}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {c.phone}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedContact && (
                <p className="text-[11px] text-primary">
                  Contato selecionado:{" "}
                  <strong>{selectedContact.name || selectedContact.phone}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-name" className="text-xs text-muted-foreground">
                  Nome (opcional)
                </Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="mt-1 h-9 border-border bg-muted text-xs"
                />
              </div>
              <div>
                <Label htmlFor="new-phone" className="text-xs text-muted-foreground">
                  Número de WhatsApp (com DDI e DDD)
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="new-phone"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+55 11 99999-8888"
                    className="h-9 border-border bg-muted pl-8 text-xs"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Initial Message */}
          <div className="space-y-1.5">
            <Label htmlFor="init-msg" className="text-xs text-muted-foreground">
              Mensagem Inicial
            </Label>
            <Textarea
              id="init-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem para enviar..."
              className="min-h-20 border-border bg-muted text-xs"
              required
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                submitting ||
                (mode === "existing" && !selectedContact) ||
                (mode === "new" && !newPhone.trim()) ||
                !message.trim()
              }
              className="h-8 gap-1.5 bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Iniciar Conversa</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
