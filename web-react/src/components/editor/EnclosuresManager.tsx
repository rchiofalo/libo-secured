import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import type { Enclosure, EnclosurePageStyle } from '@/types/document';

interface SortableEnclosureProps {
  enclosure: Enclosure;
  index: number;
  onUpdateTitle: (title: string) => void;
  onAttachFile: (file: File) => void;
  onRemoveFile: () => void;
  onRemove: () => void;
  onUpdatePageStyle: (style: EnclosurePageStyle) => void;
}

function SortableEnclosure({
  enclosure,
  index,
  onUpdateTitle,
  onAttachFile,
  onRemoveFile,
  onRemove,
  onUpdatePageStyle,
}: SortableEnclosureProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `encl-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onAttachFile(file);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border rounded-lg p-3 mb-2 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Number badge */}
        <Badge variant="secondary" className="mt-2 min-w-[32px] justify-center">
          ({index + 1})
        </Badge>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <Input
            value={enclosure.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder="Enclosure title..."
          />

          {enclosure.file ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate">{enclosure.file.name}</span>
                <span className="text-muted-foreground">
                  {(enclosure.file.size / 1024).toFixed(1)} KB
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveFile}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Page Style:</Label>
                <Select
                  value={enclosure.pageStyle || 'border'}
                  onValueChange={(v) => onUpdatePageStyle(v as EnclosurePageStyle)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="border">85% with Border</SelectItem>
                    <SelectItem value="fullpage">Full Page (No Margins)</SelectItem>
                    <SelectItem value="fit">Fit to Margins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-2 border border-dashed border-border rounded cursor-pointer hover:bg-secondary/30 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Attach PDF (optional)</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Remove button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function EnclosuresManager() {
  const {
    enclosures,
    addEnclosure,
    updateEnclosure,
    removeEnclosure,
    reorderEnclosures,
  } = useDocumentStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('encl-', ''));
      const newIndex = parseInt(String(over.id).replace('encl-', ''));
      reorderEnclosures(oldIndex, newIndex);
    }
  };

  const handleAttachFile = useCallback(async (index: number, file: File) => {
    const data = await file.arrayBuffer();
    updateEnclosure(index, {
      file: {
        name: file.name,
        size: file.size,
        data,
      },
    });
  }, [updateEnclosure]);

  const handleUploadNewEnclosure = useCallback(async (file: File) => {
    // Extract filename without extension for the title
    const title = file.name.replace(/\.pdf$/i, '');
    const data = await file.arrayBuffer();
    addEnclosure(title, {
      name: file.name,
      size: file.size,
      data,
    });
  }, [addEnclosure]);

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="enclosures">
        <AccordionTrigger>
          Enclosures
          {enclosures.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {enclosures.length}
            </Badge>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="pt-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={enclosures.map((_, i) => `encl-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                {enclosures.map((encl, index) => (
                  <SortableEnclosure
                    key={`encl-${index}`}
                    enclosure={encl}
                    index={index}
                    onUpdateTitle={(title) => updateEnclosure(index, { title })}
                    onAttachFile={(file) => handleAttachFile(index, file)}
                    onRemoveFile={() => updateEnclosure(index, { file: undefined })}
                    onRemove={() => removeEnclosure(index)}
                    onUpdatePageStyle={(pageStyle) => updateEnclosure(index, { pageStyle })}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => addEnclosure('')}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Enclosure
              </Button>
              <label className="flex-1">
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload / Drop PDF
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.type === 'application/pdf') {
                      handleUploadNewEnclosure(file);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
