import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="workspace-description">{description}</p>
      </div>
      {children && <div className="workspace-header-actions">{children}</div>}
    </header>
  );
}
