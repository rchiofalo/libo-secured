import { Plus, Pencil, Trash2, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useProfileStore } from '@/stores/profileStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';

export function ProfileBar() {
  const { profiles, selectedProfile, selectProfile, deleteProfile, importProfiles } = useProfileStore();
  const { setFormData } = useDocumentStore();
  const { setProfileModalOpen, autoSaveStatus } = useUIStore();

  const profileNames = Object.keys(profiles).sort();

  const handleProfileChange = (name: string) => {
    if (name === '__none__') {
      selectProfile(null);
      return;
    }
    selectProfile(name);
    const profile = profiles[name];
    if (profile) {
      setFormData({
        unitLine1: profile.unitLine1,
        unitLine2: profile.unitLine2,
        unitAddress: profile.unitAddress,
        ssic: profile.ssic,
        from: profile.from,
        sigFirst: profile.sigFirst,
        sigMiddle: profile.sigMiddle,
        sigLast: profile.sigLast,
        sigRank: profile.sigRank,
        sigTitle: profile.sigTitle,
        cuiControlledBy: profile.cuiControlledBy,
        pocEmail: profile.pocEmail,
      });
    }
  };

  const handleDelete = () => {
    if (!selectedProfile) return;
    if (confirm(`Delete profile "${selectedProfile}"?`)) {
      deleteProfile(selectedProfile);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify({ version: '1.0', profiles }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `libo-profiles-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.profiles) {
          importProfiles(data.profiles);
        }
      } catch (err) {
        console.error('Failed to import profiles:', err);
        alert('Failed to import profiles. Invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30">
      <Select value={selectedProfile || '__none__'} onValueChange={handleProfileChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select Profile" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">-- Select Profile --</SelectItem>
          {profileNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setProfileModalOpen(true)}
        title="Create/Edit Profile"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setProfileModalOpen(true)}
        disabled={!selectedProfile}
        title="Edit Profile"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={!selectedProfile}
        title="Delete Profile"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="ghost" size="icon" onClick={handleExport} title="Export Profiles">
        <Download className="h-4 w-4" />
      </Button>

      <label>
        <Button variant="ghost" size="icon" asChild title="Import Profiles">
          <span>
            <Upload className="h-4 w-4" />
          </span>
        </Button>
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </label>

      <div className="flex-1" />

      {autoSaveStatus && (
        <span className="text-xs text-muted-foreground">{autoSaveStatus}</span>
      )}
    </div>
  );
}
