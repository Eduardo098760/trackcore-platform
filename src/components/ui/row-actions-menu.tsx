import { ReactNode } from "react";
import { LucideIcon, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RowActionsMenuProps = {
  label: string;
  children: ReactNode;
  indicator?: ReactNode;
  contentClassName?: string;
  triggerClassName?: string;
};

type RowActionsMenuItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & {
  icon: LucideIcon;
};

export function RowActionsMenu({
  label,
  children,
  indicator,
  contentClassName,
  triggerClassName,
}: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "relative h-9 w-9 rounded-full border border-border/60 bg-muted/20 p-0 hover:bg-muted/60",
            triggerClassName,
          )}
          title={label}
          aria-label={label}
        >
          <Settings2 className="w-4 h-4" />
          {indicator}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-56", contentClassName)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RowActionsMenuItem({
  icon: Icon,
  className,
  children,
  ...props
}: RowActionsMenuItemProps) {
  return (
    <DropdownMenuItem className={cn("gap-2", className)} {...props}>
      <Icon className="w-4 h-4" />
      {children}
    </DropdownMenuItem>
  );
}