/**
 * @fileoverview Intent creation form component
 * @description Form for creating trading intents with validation
 */

import { useState, useCallback } from 'react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { cn } from '../../lib/utils/index.js';
import { IntentFormData, TokenSelectData } from '../../types/index.js';

// ============================================================================
// Token Selector Component
// ============================================================================

interface TokenSelectorProps {
  label: string;
  value: TokenSelectData | null;
  onChange: (token: TokenSelectData | null) => void;
  error?: string;
  disabled?: boolean;
  exclude?: string[];
}

function TokenSelector({ 
  label, 
  value, 
  onChange, 
  error, 
  disabled, 
  exclude = [] 
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Mock popular tokens - in real app this would come from a token list
  const popularTokens: TokenSelectData[] = [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
      isPopular: true,
      balance: '1.2345'
    },
    {
      address: '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
      isPopular: true,
      balance: '1000.50'
    },
    {
      address: '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
      isPopular: true,
      balance: '500.00'
    }
  ];

  const filteredTokens = popularTokens.filter(token => 
    !exclude.includes(token.address)
  );

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-2">
        {label}
      </label>
      
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 border rounded-md bg-background',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          error && 'border-error-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {value ? (
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-3">
              {value.symbol.slice(0, 2)}
            </div>
            <div className="text-left">
              <div className="font-medium">{value.symbol}</div>
              <div className="text-xs text-muted-foreground">{value.name}</div>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Select token</span>
        )}
        
        <svg
          className={cn(
            'w-4 h-4 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && (
        <p className="text-sm text-error-500 mt-1">{error}</p>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
          <div className="py-1">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                type="button"
                className="w-full flex items-center px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => {
                  onChange(token);
                  setIsOpen(false);
                }}
              >
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                  {token.symbol.slice(0, 2)}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{token.symbol}</div>
                  <div className="text-xs text-muted-foreground">{token.name}</div>
                </div>
                {token.balance && (
                  <div className="text-sm text-muted-foreground">
                    {parseFloat(token.balance).toFixed(4)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Amount Input Component
// ============================================================================

interface AmountInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  token: TokenSelectData | null;
  error?: string;
  disabled?: boolean;
}

function AmountInput({ 
  label, 
  value, 
  onChange, 
  token, 
  error, 
  disabled 
}: AmountInputProps) {
  const handleMaxClick = useCallback(() => {
    if (token?.balance) {
      onChange(token.balance);
    }
  }, [token?.balance, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        {token?.balance && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">
              Balance: {parseFloat(token.balance).toFixed(4)} {token.symbol}
            </span>
            <button
              type="button"
              className="text-xs text-primary hover:text-primary/80 font-medium"
              onClick={handleMaxClick}
            >
              MAX
            </button>
          </div>
        )}
      </div>
      
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          error={error}
          disabled={disabled}
          rightElement={
            token && (
              <div className="flex items-center">
                <span className="text-sm font-medium">{token.symbol}</span>
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

// ============================================================================
// Slippage Settings Component
// ============================================================================

interface SlippageSettingsProps {
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

function SlippageSettings({ value, onChange, error }: SlippageSettingsProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const presets = [0.1, 0.5, 1.0];

  const handlePresetClick = (preset: number) => {
    setIsCustom(false);
    onChange(preset * 100); // Convert to basis points
  };

  const handleCustomChange = (inputValue: string) => {
    setCustomValue(inputValue);
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      onChange(numValue * 100); // Convert to basis points
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        Max Slippage
      </label>
      
      <div className="flex items-center space-x-2 mb-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-colors',
              !isCustom && value === preset * 100
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
            onClick={() => handlePresetClick(preset)}
          >
            {preset}%
          </button>
        ))}
        
        <button
          type="button"
          className={cn(
            'px-3 py-1 rounded-md text-sm font-medium transition-colors',
            isCustom
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
          onClick={() => setIsCustom(true)}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="relative">
          <Input
            type="number"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="0.5"
            rightElement={<span className="text-sm">%</span>}
            error={error}
          />
        </div>
      )}

      {!isCustom && (
        <div className="text-sm text-muted-foreground">
          Current: {(value / 100).toFixed(1)}%
        </div>
      )}

      {error && (
        <p className="text-sm text-error-500 mt-1">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Intent Form Component
// ============================================================================

interface IntentFormProps {
  onSubmit: (formData: IntentFormData) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function IntentForm({ onSubmit, isSubmitting = false, disabled = false }: IntentFormProps) {
  const [tokenIn, setTokenIn] = useState<TokenSelectData | null>(null);
  const [tokenOut, setTokenOut] = useState<TokenSelectData | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(50); // 0.5% in basis points
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation function
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!tokenIn) {
      newErrors.tokenIn = 'Please select input token';
    }

    if (!tokenOut) {
      newErrors.tokenOut = 'Please select output token';
    }

    if (tokenIn && tokenOut && tokenIn.address === tokenOut.address) {
      newErrors.tokenOut = 'Input and output tokens must be different';
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      newErrors.amountIn = 'Please enter a valid amount';
    }

    if (tokenIn?.balance && parseFloat(amountIn) > parseFloat(tokenIn.balance)) {
      newErrors.amountIn = 'Insufficient balance';
    }

    if (slippage < 1 || slippage > 1000) { // 0.01% to 10%
      newErrors.slippage = 'Slippage must be between 0.01% and 10%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tokenIn, tokenOut, amountIn, slippage]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    if (!tokenIn || !tokenOut) {
      return;
    }

    const formData: IntentFormData = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn,
      maxSlippageBps: slippage,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [validate, tokenIn, tokenOut, amountIn, slippage, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <TokenSelector
          label="From"
          value={tokenIn}
          onChange={setTokenIn}
          error={errors.tokenIn}
          disabled={disabled}
          exclude={tokenOut ? [tokenOut.address] : []}
        />

        <AmountInput
          label="Amount"
          value={amountIn}
          onChange={setAmountIn}
          token={tokenIn}
          error={errors.amountIn}
          disabled={disabled}
        />

        <TokenSelector
          label="To"
          value={tokenOut}
          onChange={setTokenOut}
          error={errors.tokenOut}
          disabled={disabled}
          exclude={tokenIn ? [tokenIn.address] : []}
        />

        <SlippageSettings
          value={slippage}
          onChange={setSlippage}
          error={errors.slippage}
        />
      </div>

      <div className="pt-4 border-t">
        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={isSubmitting}
          disabled={disabled || isSubmitting}
        >
          {isSubmitting ? 'Creating Intent...' : 'Create Intent'}
        </Button>
      </div>
    </form>
  );
}