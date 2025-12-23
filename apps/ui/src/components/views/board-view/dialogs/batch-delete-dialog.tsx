import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Feature } from '@/store/app-store';

interface BatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFeatures: Feature[];
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function BatchDeleteDialog({
  open,
  onOpenChange,
  selectedFeatures,
  onConfirm,
  isDeleting = false,
}: BatchDeleteDialogProps) {
  const count = selectedFeatures.length;

  if (count === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="batch-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete {count} Feature{count !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete{' '}
            {count === 1 ? 'this feature' : `these ${count} features`}?
            <span className="block mt-3 text-destructive font-medium">
              This action cannot be undone.
            </span>
            {count <= 5 && (
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {selectedFeatures.map((feature) => (
                  <li key={feature.id} className="truncate">
                    &bull;{' '}
                    {feature.title || feature.description?.slice(0, 60) || 'Untitled feature'}
                    {(feature.description?.length ?? 0) > 60 && !feature.title ? '...' : ''}
                  </li>
                ))}
              </ul>
            )}
            {count > 5 && (
              <span className="block mt-3 text-sm text-muted-foreground">
                Including:{' '}
                {selectedFeatures
                  .slice(0, 3)
                  .map((f) => f.title || f.description?.slice(0, 30) || 'Untitled')
                  .join(', ')}
                {count > 3 ? ` and ${count - 3} more...` : ''}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="batch-delete-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="batch-delete-confirm-button"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? 'Deleting...' : `Delete ${count} Feature${count !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
