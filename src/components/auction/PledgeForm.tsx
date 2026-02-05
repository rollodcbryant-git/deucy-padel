import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PledgeItem, PledgeCategory } from '@/lib/types';
import { Camera, X, Loader2 } from 'lucide-react';

interface PledgeFormProps {
  tournamentId: string;
  playerId: string;
  existing?: PledgeItem | null;
  onSaved: () => void;
  onCancel?: () => void;
}

export function PledgeForm({ tournamentId, playerId, existing, onSaved, onCancel }: PledgeFormProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(existing?.title || '');
  const [category, setCategory] = useState<PledgeCategory>(existing?.category as PledgeCategory || 'food');
  const [description, setDescription] = useState(existing?.description || '');
  const [imageUrl, setImageUrl] = useState(existing?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${tournamentId}/${playerId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('pledge-images')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pledge-images')
        .getPublicUrl(path);

      setImageUrl(publicUrl);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    if (!description.trim()) {
      toast({ title: 'Description required', variant: 'destructive' });
      return;
    }
    if (!imageUrl) {
      toast({ title: 'Photo required', description: 'Snap a pic of your pledge!', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        await supabase.from('pledge_items').update({
          title, category, description, image_url: imageUrl,
        }).eq('id', existing.id);
      } else {
        await supabase.from('pledge_items').insert({
          tournament_id: tournamentId,
          pledged_by_player_id: playerId,
          title, category, description, image_url: imageUrl,
          status: 'Draft',
        });
      }
      toast({ title: existing ? 'Pledge updated! 🎁' : 'Pledge submitted! 🎁' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="chaos-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {existing ? 'Edit Your Pledge' : 'What are you bringing to the chaos?'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Photo upload */}
        <div className="space-y-2">
          <Label>Photo *</Label>
          {imageUrl ? (
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
              <img src={imageUrl} alt="Pledge" className="h-full w-full object-cover" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setImageUrl('')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center aspect-[4/3] rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Tap to snap a photo</span>
                </>
              )}
            </label>
          )}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label>What is it? *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Homemade churros" className="touch-target" />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category *</Label>
          <Select value={category} onValueChange={v => setCategory(v as PledgeCategory)}>
            <SelectTrigger className="touch-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">🍕 Food</SelectItem>
              <SelectItem value="drink">🍷 Drink</SelectItem>
              <SelectItem value="object">🎁 Object</SelectItem>
              <SelectItem value="service">💆 Service</SelectItem>
              <SelectItem value="chaos">🎲 Chaos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Short description *</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell people what makes it special..." rows={3} />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1 touch-target bg-gradient-primary hover:opacity-90">
            {saving ? 'Saving...' : existing ? 'Update Pledge' : 'Submit Pledge'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="touch-target">Cancel</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
