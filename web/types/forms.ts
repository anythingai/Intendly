/**
 * @fileoverview Form-related type definitions
 * @description Types for form validation, submission, and UI state
 */

// ============================================================================
// Form Validation Types
// ============================================================================

export interface ValidationRule<T = any> {
  required?: boolean | string;
  min?: number | string;
  max?: number | string;
  minLength?: number | string;
  maxLength?: number | string;
  pattern?: RegExp | string;
  validate?: (value: T) => boolean | string | Promise<boolean | string>;
  custom?: (value: T, values: any) => boolean | string;
}

export interface FormField<T = any> {
  name: keyof T;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'token' | 'amount';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rules?: ValidationRule<any>[];
  options?: SelectOption[];
  dependsOn?: keyof T;
  condition?: (values: T) => boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  group?: string;
}

// ============================================================================
// Intent Form Types
// ============================================================================

export interface IntentFormData {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline: number;
  receiver?: string;
}

export interface IntentFormState {
  values: IntentFormData;
  errors: Partial<Record<keyof IntentFormData, string>>;
  touched: Partial<Record<keyof IntentFormData, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface IntentFormValidation {
  tokenIn: ValidationRule[];
  tokenOut: ValidationRule[];
  amountIn: ValidationRule[];
  maxSlippageBps: ValidationRule[];
  deadline: ValidationRule[];
  receiver?: ValidationRule[];
}

// ============================================================================
// Token Selection Types
// ============================================================================

export interface TokenSelectData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  usdValue?: string;
  isPopular?: boolean;
  isVerified?: boolean;
}

export interface TokenSelectState {
  searchQuery: string;
  selectedToken: TokenSelectData | null;
  filteredTokens: TokenSelectData[];
  isLoading: boolean;
  showPopular: boolean;
  showBalance: boolean;
}

// ============================================================================
// Amount Input Types
// ============================================================================

export interface AmountInputData {
  value: string;
  token: TokenSelectData | null;
  balance: string | null;
  usdValue: string | null;
  isMax: boolean;
}

export interface AmountInputState extends AmountInputData {
  isValid: boolean;
  error: string | null;
  hasBalance: boolean;
  exceedsBalance: boolean;
  isLoading: boolean;
}

export interface AmountInputValidation {
  minAmount?: string;
  maxAmount?: string;
  requiresBalance?: boolean;
  allowZero?: boolean;
  maxDecimals?: number;
}

// ============================================================================
// Slippage Settings Types
// ============================================================================

export interface SlippageSettingsData {
  slippageBps: number;
  customSlippage: string;
  useCustom: boolean;
  autoSlippage: boolean;
}

export interface SlippagePreset {
  label: string;
  value: number;
  recommended?: boolean;
  description?: string;
}

export interface SlippageSettingsState extends SlippageSettingsData {
  presets: SlippagePreset[];
  isValid: boolean;
  warning: string | null;
  isHigh: boolean;
  isVeryHigh: boolean;
}

// ============================================================================
// Deadline Settings Types
// ============================================================================

export interface DeadlineSettingsData {
  deadlineMinutes: number;
  customDeadline: string;
  useCustom: boolean;
}

export interface DeadlinePreset {
  label: string;
  value: number;
  default?: boolean;
  description?: string;
}

export interface DeadlineSettingsState extends DeadlineSettingsData {
  presets: DeadlinePreset[];
  isValid: boolean;
  warning: string | null;
  expiresAt: Date | null;
}

// ============================================================================
// Form Submission Types
// ============================================================================

export interface FormSubmissionState {
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  result: any | null;
  submitCount: number;
}

export interface FormSubmissionOptions {
  validate?: boolean;
  resetOnSuccess?: boolean;
  showSuccessMessage?: boolean;
  showErrorMessage?: boolean;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Form Events Types
// ============================================================================

export interface FormChangeEvent<T = any> {
  field: keyof T;
  value: any;
  previousValue: any;
  isValid: boolean;
  error: string | null;
}

export interface FormSubmitEvent<T = any> {
  values: T;
  isValid: boolean;
  errors: Partial<Record<keyof T, string>>;
  timestamp: number;
}

export interface FormResetEvent {
  timestamp: number;
  reason: 'user' | 'success' | 'error' | 'programmatic';
}

// ============================================================================
// Advanced Form Types
// ============================================================================

export interface DynamicFormField extends FormField {
  showWhen?: (values: any) => boolean;
  computeValue?: (values: any) => any;
  asyncValidation?: (value: any) => Promise<string | null>;
}

export interface FormSection {
  title: string;
  description?: string;
  fields: FormField[];
  collapsible?: boolean;
  collapsed?: boolean;
  condition?: (values: any) => boolean;
}

export interface FormWizardStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  validation?: (values: any) => Promise<boolean>;
  onEnter?: (values: any) => void;
  onExit?: (values: any) => void;
  skippable?: boolean;
}

export interface FormWizardState {
  currentStep: number;
  completedSteps: number[];
  canProceed: boolean;
  canGoBack: boolean;
  isLastStep: boolean;
  progress: number;
  values: any;
  stepErrors: Record<number, string[]>;
}

// ============================================================================
// Form Configuration Types
// ============================================================================

export interface FormConfig<T = any> {
  fields: FormField<T>[];
  validation?: Partial<Record<keyof T, ValidationRule[]>>;
  submitOptions?: FormSubmissionOptions;
  autoSave?: boolean;
  autoSaveInterval?: number;
  resetOnUnmount?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showErrorSummary?: boolean;
}

export interface FormTheme {
  spacing: 'compact' | 'normal' | 'relaxed';
  labelPosition: 'top' | 'left' | 'floating';
  errorDisplay: 'inline' | 'tooltip' | 'summary';
  submitButton: 'fixed' | 'inline' | 'floating';
  fieldOrder: 'vertical' | 'horizontal' | 'grid';
}