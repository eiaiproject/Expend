import { type ComponentPropsWithoutRef } from 'react';
import { cn } from '../utils/cn';

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div 
      className={cn(
        "skeleton-shimmer rounded",
        className
      )} 
      {...props}
    />
  );
}
