/**
 * @fileoverview UI-related type definitions
 * @description Types for UI components, themes, and user interactions
 */

import { ReactNode } from 'react';

// ============================================================================
// Component Props Types
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'number' | 'email' | 'password' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  autoComplete?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export interface SelectProps extends BaseComponentProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  searchable?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

// ============================================================================
// Modal and Dialog Types
// ============================================================================

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  overlayClosable?: boolean;
}

export interface DialogProps extends ModalProps {
  type?: 'info' | 'warning' | 'error' | 'success' | 'confirm';
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

// ============================================================================
// Theme and Styling Types
// ============================================================================

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  borderRadius: number;
  fontFamily: string;
}

export interface ColorScheme {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

// ============================================================================
// Toast and Notification Types
// ============================================================================

export interface ToastOptions {
  id?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

export interface NotificationState {
  toasts: ToastOptions[];
  showToast: (options: ToastOptions) => void;
  hideToast: (id: string) => void;
  clearAll: () => void;
}

// ============================================================================
// Loading and State Types
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export interface ErrorState {
  hasError: boolean;
  error?: Error | null;
  message?: string;
  code?: string;
  retryable?: boolean;
}

export interface AsyncState<T = any> {
  data?: T;
  loading: boolean;
  error?: string;
  lastUpdated?: number;
}

// ============================================================================
// Table and List Types
// ============================================================================

export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T = any> extends BaseComponentProps {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  empty?: ReactNode;
  pagination?: PaginationProps;
  sortable?: boolean;
  selectable?: boolean;
  onRowClick?: (record: T, index: number) => void;
}

export interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
}

// ============================================================================
// Animation and Transition Types
// ============================================================================

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

export interface TransitionProps {
  show: boolean;
  enter?: string;
  enterFrom?: string;
  enterTo?: string;
  leave?: string;
  leaveFrom?: string;
  leaveTo?: string;
  children: ReactNode;
}