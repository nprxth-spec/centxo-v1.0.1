import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function PageHeader({ title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-2 flex items-center text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-1" />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-page-title">{title}</h1>
          {subtitle && <p className="text-body-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
