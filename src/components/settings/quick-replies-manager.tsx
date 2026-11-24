'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  Loader2,
  Zap,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { QuickReply } from '@/types';

export function QuickRepliesManager() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [category, setCategory] = useState('');
  const [contentText, setContentText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Delete state
  const [itemToDelete, setItemToDelete] = useState<QuickReply | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchQuickReplies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp/quick-replies');
      const data = await res.json();
      if (res.ok && data.quick_replies) {
        setQuickReplies(data.quick_replies);
      }
    } catch (err) {
      console.error('Failed to load quick replies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuickReplies();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    quickReplies.forEach((q) => {
      if (q.category) set.add(q.category);
    });
    return Array.from(set);
  }, [quickReplies]);

  const filteredReplies = useMemo(() => {
    return quickReplies.filter((qr) => {
      const matchSearch =
        qr.title.toLowerCase().includes(search.toLowerCase()) ||
        (qr.shortcut && qr.shortcut.toLowerCase().includes(search.toLowerCase())) ||
        (qr.content_text && qr.content_text.toLowerCase().includes(search.toLowerCase()));
      const matchCat =
        selectedCategory === 'all' || qr.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [quickReplies, search, selectedCategory]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setShortcut('');
    setCategory('');
    setContentText('');
    setMediaUrl('');
    setIsActive(true);
    setDialogOpen(true);
  };

  const handleOpenEdit = (qr: QuickReply) => {
    setEditingId(qr.id);
    setTitle(qr.title);
    setShortcut(qr.shortcut || '');
    setCategory(qr.category || '');
    setContentText(qr.content_text || '');
    setMediaUrl(qr.media_url || '');
    setIsActive(qr.is_active !== false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!contentText.trim()) {
      toast.error('Message content is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        shortcut: shortcut.trim() || null,
        category: category.trim() || null,
        content_text: contentText.trim(),
        media_url: mediaUrl.trim() || null,
        is_active: isActive,
        kind: 'text',
      };

      const url = editingId
        ? `/api/whatsapp/quick-replies/${editingId}`
        : '/api/whatsapp/quick-replies';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save quick reply');
      }

      toast.success(editingId ? 'Quick reply updated' : 'Quick reply created');
      setDialogOpen(false);
      fetchQuickReplies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving quick reply');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/whatsapp/quick-replies/${itemToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success('Quick reply deleted');
      setItemToDelete(null);
      fetchQuickReplies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Zap className="size-4 text-amber-500" /> Saved Quick Replies
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create reusable messages for customer service chats. These messages do not require Meta approval and can be sent during the 24-hour service window.
          </p>
        </div>

        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
          <Plus className="size-4" /> New Quick Reply
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search quick replies by name, shortcut (/welcome) or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1 overflow-x-auto text-xs py-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content List */}
      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin text-primary" /> Loading quick replies...
          </CardContent>
        </Card>
      ) : filteredReplies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground">No quick replies found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Create your first saved reply to easily respond to frequent questions in conversations with a single click.
            </p>
            <Button onClick={handleOpenCreate} size="sm" variant="outline" className="mt-4 gap-1">
              <Plus className="size-3.5" /> Create Quick Reply
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredReplies.map((qr) => (
            <Card key={qr.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="font-semibold text-sm truncate text-foreground">{qr.title}</h4>
                      {qr.is_active === false && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleOpenEdit(qr)}
                        title="Edit quick reply"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setItemToDelete(qr)}
                        title="Delete quick reply"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {qr.shortcut && (
                      <Badge variant="secondary" className="font-mono text-[10px] bg-primary/10 text-primary">
                        /{qr.shortcut}
                      </Badge>
                    )}
                    {qr.category && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Tag className="size-2.5" /> {qr.category}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 bg-muted/40 p-2 rounded">
                    {qr.content_text}
                  </p>
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                  <span>Supports: {'{{name}}'}, {'{{phone}}'}, {'{{company}}'}</span>
                  <span>{new Date(qr.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-amber-500" />
              {editingId ? 'Edit Quick Reply' : 'New Quick Reply'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Saved messages can be quickly inserted in the chat composer during customer conversations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Title *</Label>
                <Input
                  placeholder="e.g. Welcome greeting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Shortcut (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-muted-foreground font-mono text-xs">/</span>
                  <Input
                    placeholder="welcome"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    className="pl-6 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category (Optional)</Label>
              <Input
                placeholder="e.g. Sales, Support, Onboarding"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Message Content *</Label>
                <div className="flex gap-1 text-[11px] text-muted-foreground">
                  <span>Insert:</span>
                  <button
                    type="button"
                    onClick={() => setContentText((prev) => `${prev}{{name}}`)}
                    className="text-primary hover:underline"
                  >
                    {'{{name}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentText((prev) => `${prev}{{company}}`)}
                    className="text-primary hover:underline ml-1"
                  >
                    {'{{company}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentText((prev) => `${prev}{{phone}}`)}
                    className="text-primary hover:underline ml-1"
                  >
                    {'{{phone}}'}
                  </button>
                </div>
              </div>
              <Textarea
                placeholder="Hello {{name}}, thank you for contacting FallInTech. How can we help you today?"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label className="text-xs">Active Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, this reply will appear in the chat composer dropdown.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editingId ? 'Update Reply' : 'Create Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" /> Delete Quick Reply
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete &quot;{itemToDelete?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItemToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
