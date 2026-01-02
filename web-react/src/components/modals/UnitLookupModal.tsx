import { useState, useMemo } from 'react';
import { Search, X, Building2, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { UNIT_CATEGORIES, formatUnitAddress, type UnitInfo } from '@/data/unitDirectory';

interface UnitLookupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (unit: UnitInfo) => void;
}

export function UnitLookupModal({ open, onOpenChange, onSelect }: UnitLookupModalProps) {
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return UNIT_CATEGORIES;

    const searchLower = search.toLowerCase();
    return UNIT_CATEGORIES.map((category) => ({
      ...category,
      units: category.units.filter(
        (unit) =>
          unit.name.toLowerCase().includes(searchLower) ||
          unit.fullName.toLowerCase().includes(searchLower) ||
          unit.city.toLowerCase().includes(searchLower) ||
          unit.state.toLowerCase().includes(searchLower) ||
          unit.region?.toLowerCase().includes(searchLower) ||
          unit.parentCommand?.toLowerCase().includes(searchLower)
      ),
    })).filter((category) => category.units.length > 0);
  }, [search]);

  const handleSelect = (unit: UnitInfo) => {
    onSelect(unit);
    onOpenChange(false);
    setSearch('');
  };

  const totalResults = filteredCategories.reduce((acc, cat) => acc + cat.units.length, 0);

  const regionColors: Record<string, string> = {
    'East Coast': 'bg-blue-500/10 text-blue-500',
    'West Coast': 'bg-orange-500/10 text-orange-500',
    'Pacific': 'bg-green-500/10 text-green-500',
    'National Capital Region': 'bg-purple-500/10 text-purple-500',
    'Reserve': 'bg-yellow-500/10 text-yellow-600',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Unit Directory
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by unit name, location, or region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
            autoFocus
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearch('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {search ? `${totalResults} units found` : 'Browse or search Marine Corps units'}
        </p>

        <ScrollArea className="h-[400px] pr-4">
          <Accordion type="multiple" className="w-full" defaultValue={search ? filteredCategories.map((c) => c.name) : []}>
            {filteredCategories.map((category) => (
              <AccordionItem key={category.name} value={category.name}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">({category.units.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {category.units.map((unit) => (
                      <button
                        key={unit.name}
                        onClick={() => handleSelect(unit)}
                        className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-primary">{unit.name}</span>
                              {unit.region && (
                                <Badge variant="secondary" className={`text-xs ${regionColors[unit.region] || ''}`}>
                                  {unit.region}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground mt-1">{unit.fullName}</p>
                            {unit.parentCommand && (
                              <p className="text-xs text-muted-foreground">{unit.parentCommand}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {formatUnitAddress(unit)}
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No units found matching "{search}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground border-t pt-3">
          Click a unit to populate letterhead information
        </div>
      </DialogContent>
    </Dialog>
  );
}
