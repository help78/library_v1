import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
