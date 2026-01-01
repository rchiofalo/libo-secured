import { Moon, Sun, Download, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore } from '@/stores/uiStore';

interface HeaderProps {
  onDownloadPdf?: () => void;
  onDownloadTex?: () => void;
  onRefreshPreview?: () => void;
  isCompiling?: boolean;
}

export function Header({
  onDownloadPdf,
  onDownloadTex,
  onRefreshPreview,
  isCompiling,
}: HeaderProps) {
  const { theme, toggleTheme, autoSaveStatus } = useUIStore();

  return (
    <header className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">libo-secured</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            "Libo isn't secured until the paperwork is done."
          </p>
        </div>

        <div className="flex items-center gap-2">
          {autoSaveStatus && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {autoSaveStatus}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onRefreshPreview}
            disabled={isCompiling}
            title="Refresh Preview"
          >
            <RefreshCw className={`h-4 w-4 ${isCompiling ? 'animate-spin' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownloadPdf}>
                <FileText className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownloadTex}>
                <FileText className="h-4 w-4 mr-2" />
                Download LaTeX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded inline-block">
        All data stays local in your browser. Nothing is sent to any server.
      </div>
    </header>
  );
}
