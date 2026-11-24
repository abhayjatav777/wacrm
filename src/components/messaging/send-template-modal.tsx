'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  LayoutTemplate,
  Search,
  Send,
  Loader2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Contact, MessageTemplate } from '@/types';
import { extractTemplateVariables } from '@/lib/whatsapp/template-validators';

interface SendTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  conversationId?: string | null;
  onSent?: () => void;
}

export function SendTemplateModal({
  open,
  onOpenChange,
  contact,
  conversationId,
  onSent,
}: SendTemplateModalProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  // Variable values
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParam, setHeaderParam] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Fetch approved templates
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    fetch('/api/whatsapp/templates?status=APPROVED')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.templates) {
          setTemplates(data.templates);
        }
      })
      .catch((err) => {
        console.error('Failed to load templates:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // When selected template changes, initialize variables with contact auto-suggestions
  useEffect(() => {
    if (!selectedTemplate) {
      setBodyParams([]);
      setHeaderParam('');
      return;
    }

    const bodyVars = extractTemplateVariables(selectedTemplate.body_text);
    // Auto-fill first variable with contact name if available
    const initialParams = bodyVars.map((v, idx) => {
      if (idx === 0 && contact?.name) return contact.name;
      if (idx === 1 && contact?.company) return contact.company;
      return '';
    });

    setBodyParams(initialParams);
    setHeaderParam('');
  }, [selectedTemplate, contact]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchSearch =
        tpl.name.toLowerCase().includes(search.toLowerCase()) ||
        tpl.body_text.toLowerCase().includes(search.toLowerCase());
      const matchCat =
        selectedCategory === 'all' ||
        tpl.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [templates, search, selectedCategory]);

  const bodyVars = useMemo(() => {
    return selectedTemplate ? extractTemplateVariables(selectedTemplate.body_text) : [];
  }, [selectedTemplate]);

  const hasHeaderVar = useMemo(() => {
    if (!selectedTemplate) return false;
    return (
      selectedTemplate.header_type === 'text' &&
      !!selectedTemplate.header_content &&
      extractTemplateVariables(selectedTemplate.header_content).length > 0
    );
  }, [selectedTemplate]);

  // Live preview text with interpolated values
  const previewBody = useMemo(() => {
    if (!selectedTemplate) return '';
    let text = selectedTemplate.body_text;
    bodyVars.forEach((v, idx) => {
      const val = bodyParams[idx];
      const placeholder = new RegExp(`\\{\\{${v}\\}\\}`, 'g');
      text = text.replace(placeholder, val && val.trim() ? val : `{{${v}}}`);
    });
    return text;
  }, [selectedTemplate, bodyVars, bodyParams]);

  const previewHeader = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.header_content) return '';
    let text = selectedTemplate.header_content;
    if (hasHeaderVar && headerParam.trim()) {
      text = text.replace(/\{\{[A-Za-z0-9_]+\}\}/g, headerParam);
    }
    return text;
  }, [selectedTemplate, hasHeaderVar, headerParam]);

  const canSend = useMemo(() => {
    if (!selectedTemplate) return false;
    const bodyValid = bodyVars.every((_, idx) => (bodyParams[idx] || '').trim().length > 0);
    const headerValid = !hasHeaderVar || headerParam.trim().length > 0;
    return bodyValid && headerValid;
  }, [selectedTemplate, bodyVars, bodyParams, hasHeaderVar, headerParam]);

  const handleSend = async () => {
    if (!contact || !selectedTemplate || !canSend) return;

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/messages/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          contact_id: contact.id,
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language || 'en_US',
          template_params: bodyParams,
          template_message_params: {
            body: bodyParams,
            ...(headerParam ? { headerText: headerParam } : {}),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send template message');
      }

      toast.success('Template sent successfully');
      setSelectedTemplate(null);
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error sending template');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl w-[95vw] h-[85vh] max-h-[850px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <LayoutTemplate className="size-5 text-primary" /> Send WhatsApp Template
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Recipient: <span className="font-medium text-foreground">{contact?.name || 'Contact'}</span> ({contact?.phone || 'No phone'})
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs">
              Meta Approved
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left column: Template selector */}
          <div className="w-5/12 min-w-[300px] border-r border-border flex flex-col p-5 space-y-3 overflow-y-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search approved templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {['all', 'marketing', 'utility', 'authentication'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full capitalize text-xs transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
                <Loader2 className="size-5 animate-spin" /> Loading approved templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                No approved templates found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all text-xs ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground truncate">{tpl.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {tpl.category}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-[11px]">
                        {tpl.body_text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column: Template preview & variable inputs */}
          <div className="w-7/12 flex flex-col p-6 overflow-y-auto space-y-5">
            {selectedTemplate ? (
              <>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Variable Configuration
                  </h4>

                  {bodyVars.length === 0 && !hasHeaderVar ? (
                    <p className="text-xs text-muted-foreground italic">
                      This template has no dynamic variables. It is ready to send.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {hasHeaderVar && (
                        <div className="space-y-1">
                          <Label className="text-xs">Header Variable</Label>
                          <Input
                            placeholder="Value for header"
                            value={headerParam}
                            onChange={(e) => setHeaderParam(e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      )}

                      {bodyVars.map((v, idx) => (
                        <div key={v} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Variable {`{{${v}}}`}</Label>
                            {/* Auto-suggest buttons */}
                            <div className="flex gap-1 text-[10px]">
                              {contact?.name && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...bodyParams];
                                    next[idx] = contact.name || '';
                                    setBodyParams(next);
                                  }}
                                  className="text-primary hover:underline"
                                >
                                  + Name
                                </button>
                              )}
                              {contact?.company && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...bodyParams];
                                    next[idx] = contact.company || '';
                                    setBodyParams(next);
                                  }}
                                  className="text-primary hover:underline ml-1"
                                >
                                  + Company
                                </button>
                              )}
                            </div>
                          </div>
                          <Input
                            placeholder={`Enter value for {{${v}}}`}
                            value={bodyParams[idx] || ''}
                            onChange={(e) => {
                              const next = [...bodyParams];
                              next[idx] = e.target.value;
                              setBodyParams(next);
                            }}
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WhatsApp Chat Preview */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    WhatsApp Message Preview
                  </h4>
                  <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 text-xs font-sans shadow-inner">
                    {previewHeader && (
                      <div className="font-bold text-foreground mb-1">
                        {previewHeader}
                      </div>
                    )}
                    <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {previewBody}
                    </div>
                    {selectedTemplate.footer_text && (
                      <div className="text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-1">
                        {selectedTemplate.footer_text}
                      </div>
                    )}
                    {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                      <div className="mt-3 border-t border-border/60 pt-2 space-y-1.5">
                        {selectedTemplate.buttons.map((btn, i) => (
                          <div
                            key={i}
                            className="w-full text-center py-1.5 px-3 rounded bg-muted/60 text-primary text-[11px] font-medium flex items-center justify-center gap-1.5"
                          >
                            {btn.type === 'URL' ? <ExternalLink className="size-3" /> : <MessageSquare className="size-3" />}
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-6">
                <LayoutTemplate className="size-10 stroke-1 mb-2 text-muted-foreground/60" />
                Select an approved template from the list on the left to preview and configure variables.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border flex items-center justify-between sm:justify-between bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!canSend || sending}
            className="gap-2"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
