import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDocumentStore } from '@/stores/documentStore';
import type { DocTypeConfig } from '@/types/document';

interface SignatureSectionProps {
  config: DocTypeConfig;
}

export function SignatureSection({ config: _config }: SignatureSectionProps) {
  // config will be used for signature type variations (abbrev, full, dual)
  void _config;
  const { formData, setField } = useDocumentStore();

  return (
    <Accordion type="single" collapsible defaultValue="signature">
      <AccordionItem value="signature">
        <AccordionTrigger>Signature Block</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            {/* Name fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sigFirst">First Name</Label>
                <Input
                  id="sigFirst"
                  value={formData.sigFirst || ''}
                  onChange={(e) => setField('sigFirst', e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigMiddle">M.I.</Label>
                <Input
                  id="sigMiddle"
                  value={formData.sigMiddle || ''}
                  onChange={(e) => setField('sigMiddle', e.target.value)}
                  placeholder="A."
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigLast">Last Name</Label>
                <Input
                  id="sigLast"
                  value={formData.sigLast || ''}
                  onChange={(e) => setField('sigLast', e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Rank and Title */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sigRank">Rank</Label>
                <Input
                  id="sigRank"
                  value={formData.sigRank || ''}
                  onChange={(e) => setField('sigRank', e.target.value)}
                  placeholder="e.g., Sgt, USMC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigTitle">Title/Position</Label>
                <Input
                  id="sigTitle"
                  value={formData.sigTitle || ''}
                  onChange={(e) => setField('sigTitle', e.target.value)}
                  placeholder="e.g., Operations NCO"
                />
              </div>
            </div>

            {/* By Direction */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="byDirection"
                  checked={formData.byDirection || false}
                  onCheckedChange={(checked) => setField('byDirection', !!checked)}
                />
                <Label htmlFor="byDirection" className="font-normal">
                  By direction of...
                </Label>
              </div>

              {formData.byDirection && (
                <div className="space-y-2 ml-6">
                  <Label htmlFor="byDirectionAuthority">Authority</Label>
                  <Input
                    id="byDirectionAuthority"
                    value={formData.byDirectionAuthority || ''}
                    onChange={(e) => setField('byDirectionAuthority', e.target.value)}
                    placeholder="the Commanding Officer"
                  />
                </div>
              )}
            </div>

            {/* POC Email */}
            <div className="space-y-2">
              <Label htmlFor="pocEmail">POC Email</Label>
              <Input
                id="pocEmail"
                type="email"
                value={formData.pocEmail || ''}
                onChange={(e) => setField('pocEmail', e.target.value)}
                placeholder="john.doe@usmc.mil"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
