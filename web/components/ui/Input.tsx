/**
 * @fileoverview Input component
 * @description Reusable input component with validation states
 */

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils/index.js';

// ============================================================================
// Input Variants
// ============================================================================

const inputVariants = cva(
  'flex w-full rounded-md border bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error: 'border-error-500 focus-visible:ring-error-500',
        success: 'border-success-500 focus-visible:ring-success-500'
      },
      size: {
        default: 'h-10',
        sm: 'h-9',
        lg: 'h-11'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

// ============================================================================
// Input Props
// ============================================================================

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

// ============================================================================
// Input Component
// ============================================================================

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    variant,
    size,
    type = 'text',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    leftElement,
    rightElement,
    id,
    ...props
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
    const hasError = !!error;
    const inputVariant = hasError ? 'error' : variant;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {(leftIcon || leftElement) && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
              {leftIcon && (
                <span className="text-muted-foreground w-4 h-4">
                  {leftIcon}
                </span>
              )}
              {leftElement}
            </div>
          )}
          
          <input
            type={type}
            className={cn(
              inputVariants({ variant: inputVariant, size }),
              (leftIcon || leftElement) && 'pl-10',
              (rightIcon || rightElement) && 'pr-10',
              className
            )}
            ref={ref}
            id={inputId}
            {...props}
          />
          
          {(rightIcon || rightElement) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
              {rightElement}
              {rightIcon && (
                <span className="text-muted-foreground w-4 h-4">
                  {rightIcon}
                </span>
              )}
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <div className="mt-1">
            {error && (
              <p className="text-sm text-error-500" role="alert">
                {error}
              </p>
            )}
            {!error && helperText && (
              <p className="text-sm text-muted-foreground">
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };