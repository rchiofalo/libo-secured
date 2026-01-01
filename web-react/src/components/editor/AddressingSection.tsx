import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDocumentStore } from '@/stores/documentStore';
import { SSICLookupModal } from '@/components/modals/SSICLookupModal';
import type { DocTypeConfig } from '@/types/document';

interface AddressingSectionProps {
  config: DocTypeConfig;
}

export function AddressingSection({ config }: AddressingSectionProps) {
  const { formData, setField } = useDocumentStore();
  const [ssicModalOpen, setSSICModalOpen] = useState(false);

  const handleSSICSelect = (code: string) => {
    setField('ssic', code);
  };

  return (
    <>
      <SSICLookupModal
        open={ssicModalOpen}
        onOpenChange={setSSICModalOpen}
        onSelect={handleSSICSelect}
      />

      <Accordion type="single" collapsible defaultValue="addressing">
        <AccordionItem value="addressing">
          <AccordionTrigger>Document Information</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {/* SSIC / Serial / Date */}
              {config.ssic && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ssic">SSIC</Label>
                    <div className="flex gap-1">
                      <Input
                        id="ssic"
                        value={formData.ssic || ''}
                        onChange={(e) => setField('ssic', e.target.value)}
                        placeholder="5216"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setSSICModalOpen(true)}
                        title="Browse SSIC Codes"
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial</Label>
                  <Input
                    id="serial"
                    value={formData.serial || ''}
                    onChange={(e) => setField('serial', e.target.value)}
                    placeholder="001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    value={formData.date || ''}
                    onChange={(e) => setField('date', e.target.value)}
                    placeholder="1 January 2025"
                  />
                </div>
              </div>
            )}

            {/* From / To */}
            {config.fromTo && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="from">From</Label>
                  <Input
                    id="from"
                    value={formData.from || ''}
                    onChange={(e) => setField('from', e.target.value)}
                    placeholder="Commanding Officer, 1st Battalion, 6th Marines"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to">To</Label>
                  <Input
                    id="to"
                    value={formData.to || ''}
                    onChange={(e) => setField('to', e.target.value)}
                    placeholder="Commanding General, 2d Marine Division"
                  />
                </div>
              </>
            )}

            {/* Via */}
            {config.via && (
              <div className="space-y-2">
                <Label htmlFor="via">Via (one per line)</Label>
                <Textarea
                  id="via"
                  value={formData.via || ''}
                  onChange={(e) => setField('via', e.target.value)}
                  placeholder="(1) Commanding Officer, 6th Marine Regiment&#10;(2) Commanding General, 2d Marine Division"
                  rows={3}
                />
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={formData.subject || ''}
                onChange={(e) => setField('subject', e.target.value)}
                placeholder="SUBJECT LINE IN ALL CAPS"
                className="uppercase"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    </>
  );
}
