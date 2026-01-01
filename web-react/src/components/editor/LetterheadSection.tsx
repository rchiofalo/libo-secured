import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDocumentStore } from '@/stores/documentStore';

export function LetterheadSection() {
  const { formData, setField } = useDocumentStore();

  return (
    <Accordion type="single" collapsible defaultValue="letterhead">
      <AccordionItem value="letterhead">
        <AccordionTrigger>Letterhead</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="unitLine1">Command Name (Line 1)</Label>
              <Input
                id="unitLine1"
                value={formData.unitLine1 || ''}
                onChange={(e) => setField('unitLine1', e.target.value)}
                placeholder="e.g., 1ST BATTALION, 6TH MARINES"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitLine2">Command Name (Line 2)</Label>
              <Input
                id="unitLine2"
                value={formData.unitLine2 || ''}
                onChange={(e) => setField('unitLine2', e.target.value)}
                placeholder="e.g., 6TH MARINE REGIMENT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitAddress">Address</Label>
              <Input
                id="unitAddress"
                value={formData.unitAddress || ''}
                onChange={(e) => setField('unitAddress', e.target.value)}
                placeholder="e.g., PSC BOX 20123, CAMP LEJEUNE, NC 28542"
              />
            </div>

            <div className="space-y-2">
              <Label>Seal Type</Label>
              <Select
                value={formData.sealType || 'dod'}
                onValueChange={(v) => setField('sealType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dod">Department of Defense</SelectItem>
                  <SelectItem value="dow">Department of War (Historical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
