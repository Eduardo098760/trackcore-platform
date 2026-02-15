import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  stats?: Array<{
    label: string;
    value: number | string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
  }>;
}

export function PageHeader({ icon: Icon, title, description, action, stats }: PageHeaderProps) {
  const getStatColor = (variant: string = 'default') => {
    switch (variant) {
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'danger':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <div className="border-b bg-card">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Icon className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="px-4 pb-4 flex gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatColor(stat.variant)}`} />
              <span className="text-sm">
                <span className="font-semibold">{stat.value}</span>{' '}
                <span className="text-muted-foreground">{stat.label}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
