'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Clock,
  Send,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  AlertCircle,
  Sparkles,
  X,
  FileAudio,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Contact, QuickReply } from '@/types';
import { interpolateVariables } from '@/lib/quick-replies/variables';

interface SendFreeMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  conversationId?: string | null;
  onSent?: () => void;
  onOpenTemplateModal?: () => void;
}

interface WindowData {
  isOpen: boolean;
  expiresAt: string | null;
  remainingSeconds?: number;
  formattedRemaining?: string;
  remainingFormatted?: string;
  lastCustomerMessageAt?: string | null;
}

interface UsageData {
  billingPeriod?: string;
  phoneNumberId?: string;
  freeAllowance?: number;
  deliveredServiceMessages?: number;
  billableServiceMessages?: number;
  remainingFreeMessages?: number;
  freeMessagesRemaining?: number;
  isAllowanceExhausted?: boolean;
}

export function SendFreeMessageModal({
  open,
  onOpenChange,
  contact,
  conversationId,
  onSent,
  onOpenTemplateModal,
}: SendFreeMessageModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'video' | 'audio' | 'document'>('text');
  const [contentText, setContentText] = useState('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  // Service window state
  const [windowLoading, setWindowLoading] = useState(true);
  const [windowData, setWindowData] = useState<WindowData | null>(null);

  // Usage state
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  // Quick replies state
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string>('');

  // Media files
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch window status & usage when modal opens
  useEffect(() => {
    if (!open || !contact) return;

    let cancelled = false;

    async function loadMetadata() {
      setWindowLoading(true);

      try {
        // Fetch quick replies
        fetch('/api/whatsapp/quick-replies')
          .then((r) => r.json())
          .then((data) => {
            if (!cancelled && data.quick_replies) {
              setQuickReplies(data.quick_replies.filter((q: QuickReply) => q.is_active !== false));
            }
          })
          .catch(() => {});

        // Fetch usage
        fetch('/api/whatsapp/usage')
          .then((r) => r.json())
          .then((data) => {
            if (!cancelled && data.usage) {
              setUsageData(data.usage);
            }
          })
          .catch(() => {});

        // If conversationId is provided, check window directly
        if (conversationId) {
          const res = await fetch(`/api/whatsapp/conversations/${conversationId}/window`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data.window) {
              setWindowData(data.window);
              setWindowLoading(false);
              return;
            }
          }
        }

        // Otherwise default window check for contact
        if (!cancelled) {
          // If no conversation exists yet or no inbound message, window is closed by default
          setWindowData({
            isOpen: false,
            remainingSeconds: 0,
            formattedRemaining: 'Expired / Closed',
            remainingFormatted: 'Expired / Closed',
            expiresAt: null,
          });
          setWindowLoading(false);
        }
      } catch {
        if (!cancelled) {
          setWindowLoading(false);
        }
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [open, contact, conversationId]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleInsertQuickReply = (qrId: string) => {
    setSelectedQuickReplyId(qrId);
    if (!qrId) return;

    const qr = quickReplies.find((q) => q.id === qrId);
    if (!qr || !qr.content_text) return;

    const populated = interpolateVariables(qr.content_text, {
      name: contact?.name || '',
      phone: contact?.phone || '',
      company: contact?.company || '',
    });

    if (activeTab === 'text') {
      setContentText(populated);
    } else {
      setCaption(populated);
    }
  };

  const handleSend = async () => {
    if (!contact) return;
    if (windowData && !windowData.isOpen) {
      toast.error('The 24-hour service window is closed. Please send an approved template.');
      return;
    }

    setSending(true);
    try {
      if (activeTab === 'text') {
        const trimmed = contentText.trim();
        if (!trimmed) {
          toast.error('Please enter message text');
          setSending(false);
          return;
        }

        const res = await fetch('/api/whatsapp/messages/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            contact_id: contact.id,
            content_text: trimmed,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to send message');
        }

        toast.success('Free message sent successfully');
        setContentText('');
        onOpenChange(false);
        onSent?.();
      } else {
        if (!selectedFile) {
          toast.error('Please select a file to send');
          setSending(false);
          return;
        }

        const formData = new FormData();
        if (conversationId) formData.append('conversation_id', conversationId);
        formData.append('contact_id', contact.id);
        formData.append('message_type', activeTab);
        formData.append('file', selectedFile);
        if (caption.trim()) {
          formData.append('caption', caption.trim());
        }

        const res = await fetch('/api/whatsapp/messages/media', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to send media message');
        }

        toast.success(`${activeTab} message sent successfully`);
        setSelectedFile(null);
        setCaption('');
        onOpenChange(false);
        onSent?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error sending message');
    } finally {
      setSending(false);
    }
  };

  const isWindowOpen = windowData?.isOpen ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                Send Free Message
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Recipient: <span className="font-medium text-foreground">{contact?.name || 'Contact'}</span> ({contact?.phone || 'No phone'})
              </p>
            </div>
          </div>

          {/* Service Window & Free Allowance Banner */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {windowLoading ? (
              <Badge variant="outline" className="gap-1.5 py-1 text-muted-foreground animate-pulse">
                <Loader2 className="size-3 animate-spin" /> Checking 24h window...
              </Badge>
            ) : isWindowOpen ? (
              <Badge variant="outline" className="gap-1.5 py-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-medium">
                <Clock className="size-3" /> 24h Window Open ({windowData?.formattedRemaining || windowData?.remainingFormatted || '24h remaining'})
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 py-1 border-destructive/30 bg-destructive/10 text-destructive font-medium">
                <AlertCircle className="size-3" /> 24h Window Expired / Closed
              </Badge>
            )}

            {usageData && (
              <Badge variant="secondary" className="gap-1 py-1 text-xs">
                {(usageData.remainingFreeMessages ?? usageData.freeAllowance ?? usageData.freeMessagesRemaining ?? 1000).toLocaleString()} / 1,000 Free Service Messages Left
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Closed Window Warning Notice */}
        {!windowLoading && !isWindowOpen && (
          <div className="mx-6 mt-4 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs flex flex-col gap-2">
            <div className="flex items-start gap-2 font-medium">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>Customer Service Window is Expired</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Meta WhatsApp Cloud API rules require that free-form messages (text and media) can only be sent within 24 hours of the customer&apos;s last inbound message. To start or reopen this conversation, you must send an approved WhatsApp Template.
            </p>
            <div className="mt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onOpenTemplateModal?.();
                }}
                className="border-amber-500/40 text-foreground hover:bg-amber-500/20"
              >
                Send Approved Template Instead
              </Button>
            </div>
          </div>
        )}

        {/* Composer Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Quick Replies Picker */}
          {quickReplies.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" /> Insert Quick Reply
                </Label>
                {selectedQuickReplyId && (
                  <button
                    type="button"
                    onClick={() => handleInsertQuickReply('')}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <select
                value={selectedQuickReplyId}
                onChange={(e) => handleInsertQuickReply(e.target.value)}
                disabled={!isWindowOpen}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Choose a saved reply...</option>
                {quickReplies.map((qr) => (
                  <option key={qr.id} value={qr.id}>
                    {qr.shortcut ? `/${qr.shortcut} - ` : ''}{qr.title} {qr.category ? `(${qr.category})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message Type Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) =>
              setActiveTab(val as 'text' | 'image' | 'video' | 'audio' | 'document')
            }
          >
            <TabsList className="grid grid-cols-5 w-full text-xs">
              <TabsTrigger value="text" className="text-xs">Text</TabsTrigger>
              <TabsTrigger value="image" className="text-xs">Image</TabsTrigger>
              <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
              <TabsTrigger value="audio" className="text-xs">Audio</TabsTrigger>
              <TabsTrigger value="document" className="text-xs">Document</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Message Text</Label>
                <span className="text-[11px] text-muted-foreground">{contentText.length} / 4096</span>
              </div>
              <Textarea
                placeholder="Type your message here... Use {{name}}, {{phone}}, {{company}} for variables"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={5}
                disabled={!isWindowOpen || sending}
                className="resize-none text-sm"
              />
            </TabsContent>

            <TabsContent value="image" className="mt-4 space-y-3">
              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={!isWindowOpen || sending}
                  className="hidden"
                  id="free-message-image-upload"
                />
                {selectedFile && filePreviewUrl ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      className="max-h-48 rounded object-contain mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                    >
                      <X className="size-3" />
                    </button>
                    <p className="text-xs text-muted-foreground mt-2">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                  </div>
                ) : (
                  <label
                    htmlFor="free-message-image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2 py-4"
                  >
                    <ImageIcon className="size-8 text-muted-foreground" />
                    <span className="text-xs font-medium">Select Image (JPG, PNG, WebP &lt; 5MB)</span>
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Image Caption (Optional)</Label>
                <Input
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={!isWindowOpen || sending}
                  className="text-xs"
                />
              </div>
            </TabsContent>

            <TabsContent value="video" className="mt-4 space-y-3">
              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="video/mp4,video/3gpp"
                  onChange={handleFileChange}
                  disabled={!isWindowOpen || sending}
                  className="hidden"
                  id="free-message-video-upload"
                />
                {selectedFile && filePreviewUrl ? (
                  <div className="relative inline-block">
                    <video src={filePreviewUrl} controls className="max-h-48 rounded mx-auto" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                    >
                      <X className="size-3" />
                    </button>
                    <p className="text-xs text-muted-foreground mt-2">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                  </div>
                ) : (
                  <label
                    htmlFor="free-message-video-upload"
                    className="cursor-pointer flex flex-col items-center gap-2 py-4"
                  >
                    <Video className="size-8 text-muted-foreground" />
                    <span className="text-xs font-medium">Select MP4 Video (&lt; 16MB)</span>
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Video Caption (Optional)</Label>
                <Input
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={!isWindowOpen || sending}
                  className="text-xs"
                />
              </div>
            </TabsContent>

            <TabsContent value="audio" className="mt-4 space-y-3">
              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="audio/ogg,audio/mpeg,audio/aac,audio/m4a,audio/mp4"
                  onChange={handleFileChange}
                  disabled={!isWindowOpen || sending}
                  className="hidden"
                  id="free-message-audio-upload"
                />
                {selectedFile && filePreviewUrl ? (
                  <div className="relative inline-block w-full max-w-sm">
                    <audio src={filePreviewUrl} controls className="w-full mx-auto" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                    >
                      <X className="size-3" />
                    </button>
                    <p className="text-xs text-muted-foreground mt-2">{selectedFile.name}</p>
                  </div>
                ) : (
                  <label
                    htmlFor="free-message-audio-upload"
                    className="cursor-pointer flex flex-col items-center gap-2 py-4"
                  >
                    <FileAudio className="size-8 text-muted-foreground" />
                    <span className="text-xs font-medium">Select Audio (OGG, MP3, AAC, M4A &lt; 16MB)</span>
                  </label>
                )}
              </div>
            </TabsContent>

            <TabsContent value="document" className="mt-4 space-y-3">
              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleFileChange}
                  disabled={!isWindowOpen || sending}
                  className="hidden"
                  id="free-message-doc-upload"
                />
                {selectedFile ? (
                  <div className="relative inline-flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="size-6 text-primary" />
                    <div className="text-left text-xs">
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="free-message-doc-upload"
                    className="cursor-pointer flex flex-col items-center gap-2 py-4"
                  >
                    <Paperclip className="size-8 text-muted-foreground" />
                    <span className="text-xs font-medium">Select Document (PDF, DOCX, XLSX, TXT &lt; 100MB)</span>
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Document Caption (Optional)</Label>
                <Input
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={!isWindowOpen || sending}
                  className="text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>
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
            disabled={!isWindowOpen || sending}
            className="gap-2"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send Free Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
