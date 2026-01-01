import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDocumentStore } from '@/stores/documentStore';
import { DOC_TYPE_LABELS, DOC_TYPE_CONFIG, DOC_TYPE_CATEGORIES } from '@/types/document';
import { Badge } from '@/components/ui/badge';

export function DocumentTypeSelector() {
  const { docType, setDocType, formData, setField } = useDocumentStore();
  const config = DOC_TYPE_CONFIG[docType];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Document Type</Label>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger>
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPE_CATEGORIES.map((cat) => (
              <SelectGroup key={cat.category}>
                <SelectLabel>{cat.category}</SelectLabel>
                {cat.types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {DOC_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Regulation hints */}
      {config && (
        <div className="bg-secondary/30 border border-border rounded-md p-3 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              SECNAV M-5216.5 {config.regulations.ref}
            </Badge>
          </div>
          <div className="text-muted-foreground">
            Recommended: {config.regulations.fontSize} {config.regulations.fontFamily}
          </div>
        </div>
      )}

      {/* Font settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Size</Label>
          <Select
            value={formData.fontSize || '12pt'}
            onValueChange={(v) => setField('fontSize', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10pt">10pt</SelectItem>
              <SelectItem value="11pt">11pt</SelectItem>
              <SelectItem value="12pt">12pt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select
            value={formData.fontFamily || 'courier'}
            onValueChange={(v) => setField('fontFamily', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="courier">Courier</SelectItem>
              <SelectItem value="times">Times New Roman</SelectItem>
              <SelectItem value="arial">Arial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
