import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useUIStore } from '@/stores/uiStore';
import { useProfileStore } from '@/stores/profileStore';
import { useDocumentStore } from '@/stores/documentStore';
import type { Profile } from '@/types/document';

const EMPTY_PROFILE: Profile = {
  unitLine1: '',
  unitLine2: '',
  unitAddress: '',
  ssic: '',
  from: '',
  sigFirst: '',
  sigMiddle: '',
  sigLast: '',
  sigRank: '',
  sigTitle: '',
  byDirection: false,
  byDirectionAuthority: '',
  cuiControlledBy: '',
  pocEmail: '',
};

export function ProfileModal() {
  const { profileModalOpen, setProfileModalOpen } = useUIStore();
  const { profiles, selectedProfile, addProfile, updateProfile } = useProfileStore();
  const { formData } = useDocumentStore();

  const [profileName, setProfileName] = useState('');
  const [formState, setFormState] = useState<Profile>(EMPTY_PROFILE);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Store initial state to compare for changes
  const initialStateRef = useRef<{ name: string; profile: Profile }>({ name: '', profile: EMPTY_PROFILE });

  const isEditing = !!(selectedProfile && profiles[selectedProfile]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    const initial = initialStateRef.current;

    // Check profile name (only for new profiles)
    if (!isEditing && profileName !== initial.name) {
      return true;
    }

    // Check each field in formState
    const profileKeys = Object.keys(EMPTY_PROFILE) as (keyof Profile)[];
    for (const key of profileKeys) {
      const currentVal = formState[key];
      const initialVal = initial.profile[key];

      // Handle boolean comparison
      if (typeof currentVal === 'boolean' || typeof initialVal === 'boolean') {
        if (Boolean(currentVal) !== Boolean(initialVal)) {
          return true;
        }
      } else {
        // String comparison
        if ((currentVal || '') !== (initialVal || '')) {
          return true;
        }
      }
    }

    return false;
  }, [formState, profileName, isEditing]);

  // Populate form when editing
  useEffect(() => {
    if (profileModalOpen) {
      if (isEditing && selectedProfile) {
        const profile = profiles[selectedProfile];
        setProfileName(selectedProfile);
        setFormState({ ...EMPTY_PROFILE, ...profile });
        initialStateRef.current = { name: selectedProfile, profile: { ...EMPTY_PROFILE, ...profile } };
      } else {
        // Creating new - use current form data as defaults
        const newProfile: Profile = {
          unitLine1: formData.unitLine1 || '',
          unitLine2: formData.unitLine2 || '',
          unitAddress: formData.unitAddress || '',
          ssic: formData.ssic || '',
          from: formData.from || '',
          sigFirst: formData.sigFirst || '',
          sigMiddle: formData.sigMiddle || '',
          sigLast: formData.sigLast || '',
          sigRank: formData.sigRank || '',
          sigTitle: formData.sigTitle || '',
          byDirection: formData.byDirection || false,
          byDirectionAuthority: formData.byDirectionAuthority || '',
          cuiControlledBy: formData.cuiControlledBy || '',
          pocEmail: formData.pocEmail || '',
        };
        setProfileName('');
        setFormState(newProfile);
        initialStateRef.current = { name: '', profile: { ...newProfile } };
      }
    }
  }, [profileModalOpen, isEditing, selectedProfile, profiles, formData]);

  const handleSave = () => {
    if (!profileName.trim()) {
      alert('Please enter a profile name');
      return;
    }

    if (isEditing && selectedProfile) {
      updateProfile(selectedProfile, formState);
    } else {
      addProfile(profileName.trim(), formState);
    }

    setProfileModalOpen(false);
  };

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowDiscardDialog(true);
    } else {
      setProfileModalOpen(false);
    }
  }, [hasUnsavedChanges, setProfileModalOpen]);

  const handleDiscardConfirm = () => {
    setShowDiscardDialog(false);
    setProfileModalOpen(false);
  };

  const updateField = (field: keyof Profile, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Dialog open={profileModalOpen} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
          showCloseButton={false}
        >
          {/* Sticky Header */}
          <DialogHeader className="bg-background px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>
                {isEditing ? 'Edit Profile' : 'Create New Profile'}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-sm opacity-70 hover:opacity-100"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="profileName">Profile Name</Label>
                <Input
                  id="profileName"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., My Command"
                  disabled={isEditing}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Letterhead Information</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="unitLine1">Command Line 1</Label>
                    <Input
                      id="unitLine1"
                      value={formState.unitLine1}
                      onChange={(e) => updateField('unitLine1', e.target.value)}
                      placeholder="1ST BATTALION, 6TH MARINES"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitLine2">Command Line 2</Label>
                    <Input
                      id="unitLine2"
                      value={formState.unitLine2}
                      onChange={(e) => updateField('unitLine2', e.target.value)}
                      placeholder="6TH MARINE REGIMENT"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitAddress">Address</Label>
                    <Input
                      id="unitAddress"
                      value={formState.unitAddress}
                      onChange={(e) => updateField('unitAddress', e.target.value)}
                      placeholder="PSC BOX 20123, CAMP LEJEUNE, NC 28542"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Default Document Info</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ssic">Default SSIC</Label>
                    <Input
                      id="ssic"
                      value={formState.ssic}
                      onChange={(e) => updateField('ssic', e.target.value)}
                      placeholder="5216"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="from">Default From</Label>
                    <Input
                      id="from"
                      value={formState.from}
                      onChange={(e) => updateField('from', e.target.value)}
                      placeholder="Commanding Officer, 1st Battalion, 6th Marines"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Signature Block</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sigFirst">First Name</Label>
                    <Input
                      id="sigFirst"
                      value={formState.sigFirst}
                      onChange={(e) => updateField('sigFirst', e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sigMiddle">Middle</Label>
                    <Input
                      id="sigMiddle"
                      value={formState.sigMiddle}
                      onChange={(e) => updateField('sigMiddle', e.target.value)}
                      placeholder="Q."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sigLast">Last Name</Label>
                    <Input
                      id="sigLast"
                      value={formState.sigLast}
                      onChange={(e) => updateField('sigLast', e.target.value)}
                      placeholder="SMITH"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="sigRank">Rank</Label>
                    <Input
                      id="sigRank"
                      value={formState.sigRank}
                      onChange={(e) => updateField('sigRank', e.target.value)}
                      placeholder="LtCol, USMC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sigTitle">Title</Label>
                    <Input
                      id="sigTitle"
                      value={formState.sigTitle}
                      onChange={(e) => updateField('sigTitle', e.target.value)}
                      placeholder="Commanding Officer"
                    />
                  </div>
                </div>

                {/* By Direction */}
                <div className="space-y-3 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="byDirection"
                      checked={formState.byDirection || false}
                      onCheckedChange={(checked) => updateField('byDirection', !!checked)}
                    />
                    <Label htmlFor="byDirection" className="font-normal">
                      By direction of...
                    </Label>
                  </div>

                  {formState.byDirection && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="byDirectionAuthority">Authority</Label>
                      <Input
                        id="byDirectionAuthority"
                        value={formState.byDirectionAuthority || ''}
                        onChange={(e) => updateField('byDirectionAuthority', e.target.value)}
                        placeholder="the Commanding Officer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">CUI Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cuiControlledBy">Controlled By</Label>
                    <Input
                      id="cuiControlledBy"
                      value={formState.cuiControlledBy || ''}
                      onChange={(e) => updateField('cuiControlledBy', e.target.value)}
                      placeholder="DoD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pocEmail">POC Email</Label>
                    <Input
                      id="pocEmail"
                      type="email"
                      value={formState.pocEmail || ''}
                      onChange={(e) => updateField('pocEmail', e.target.value)}
                      placeholder="john.smith@usmc.mil"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <DialogFooter className="bg-background px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save Changes' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this profile. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
