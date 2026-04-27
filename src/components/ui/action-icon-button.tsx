import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button, type ButtonProps } from "@/components/ui/button";

type ActionIconButtonProps = Omit<ButtonProps, "children"> & {
  children: ReactNode;
  label: string;
  destructive?: boolean;
};

export function ActionIconButton({
  children,
  label,
  destructive = false,
  className,
  type = "button",
  variant = "ghost",
  ...props
}: ActionIconButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      title={label}
      aria-label={label}
      className={cn(
        destructive && "text-destructive hover:text-destructive",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}