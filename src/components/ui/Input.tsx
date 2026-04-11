'use client';

import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#f4efeb]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aba8a4]">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full bg-[#111311] border rounded-xl px-4 py-2.5 text-sm text-[#f4efeb]',
              'placeholder:text-[#aba8a4]/60',
              'focus:outline-none focus:ring-2 focus:ring-[#349f2d]/50 focus:border-[#349f2d]',
              'transition-colors duration-200',
              error ? 'border-red-500/60' : 'border-[#2b2f2b] hover:border-[#404540]',
              icon ? 'pl-9' : '',
              iconRight ? 'pr-9' : '',
              className,
            ].join(' ')}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aba8a4]">
              {iconRight}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#aba8a4]">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#f4efeb]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={[
            'w-full bg-[#111311] border rounded-xl px-4 py-2.5 text-sm text-[#f4efeb]',
            'focus:outline-none focus:ring-2 focus:ring-[#349f2d]/50 focus:border-[#349f2d]',
            'transition-colors duration-200',
            error ? 'border-red-500/60' : 'border-[#2b2f2b] hover:border-[#404540]',
            className,
          ].join(' ')}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#191c19]">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#aba8a4]">{hint}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#f4efeb]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          className={[
            'w-full bg-[#111311] border rounded-xl px-4 py-2.5 text-sm text-[#f4efeb]',
            'placeholder:text-[#aba8a4]/60 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-[#349f2d]/50 focus:border-[#349f2d]',
            'transition-colors duration-200',
            error ? 'border-red-500/60' : 'border-[#2b2f2b] hover:border-[#404540]',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#aba8a4]">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
