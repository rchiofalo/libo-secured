import { Bold, Italic, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RichTextToolbarProps {
  onFormat: (format: 'bold' | 'italic' | 'underline') => void;
}

export function RichTextToolbar({ onFormat }: RichTextToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 mb-2 p-1 bg-secondary/30 rounded-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onFormat('bold')}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Bold (**text**)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onFormat('italic')}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Italic (*text*)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onFormat('underline')}
            >
              <Underline className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Underline (__text__)</p>
          </TooltipContent>
        </Tooltip>

        <span className="text-xs text-muted-foreground ml-2">
          Select text, then click to format
        </span>
      </div>
    </TooltipProvider>
  );
}

/**
 * Wrap selected text in a textarea with formatting markers
 */
export function applyFormat(
  textarea: HTMLTextAreaElement,
  format: 'bold' | 'italic' | 'underline'
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  if (!selectedText) return text;

  const markers = {
    bold: ['**', '**'],
    italic: ['*', '*'],
    underline: ['__', '__'],
  };

  const [open, close] = markers[format];
  const newText = text.substring(0, start) + open + selectedText + close + text.substring(end);

  return newText;
}
