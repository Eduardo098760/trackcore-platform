'use client';

import { Bell } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';

interface NotificationBadgeProps {
  count: number;
  onClick: () => void;
}

export function NotificationBadge({ count, onClick }: NotificationBadgeProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      onClick={onClick}
    >
      <Bell className="h-[18px] w-[18px]" />
      {count > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {count > 9 ? '9+' : count}
        </Badge>
      )}
    </Button>
  );
}
