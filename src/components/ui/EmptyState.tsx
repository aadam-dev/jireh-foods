import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1b1e1b] border border-[#2b2f2b] flex items-center justify-center mb-4 text-[#aba8a4]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#f4efeb] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#aba8a4] max-w-xs">{description}</p>}
      {action && (
        <div className="mt-5">
          <Button onClick={action.onClick} size="sm">{action.label}</Button>
        </div>
      )}
    </div>
  );
}
