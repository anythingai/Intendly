# Frontend Web App

Next.js 14 frontend dApp for the Intent-Based Trading Aggregator.

## Overview

The frontend provides a modern, intuitive interface for intent-based trading:

- **Intent Creation**: Simple form to express trading intentions
- **Real-time Updates**: Live bid updates via WebSocket
- **Wallet Integration**: Seamless Web3 wallet connection
- **Responsive Design**: Mobile-first, cross-device compatibility
- **Performance Optimized**: Server-side rendering and code splitting

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Custom Design System
- **Web3**: Wagmi v2 + Viem for blockchain interactions
- **State**: Zustand for client-side state management
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Native WebSocket API
- **UI Components**: Headless UI + Custom components

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Pages       │    │   Components    │    │     Hooks       │
│                 │    │                 │    │                 │
│ • app/page.tsx  │◄──►│ • IntentForm    │◄──►│ • useIntentFlow │
│ • app/layout    │    │ • BidDisplay    │    │ • useWebSocket  │
│ • Error/Loading │    │ • WalletConnect │    │ • useSignIntent │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Shared Lib    │
                    │                 │
                    │ • API Client    │
                    │ • EIP-712       │
                    │ • Contracts     │
                    │ • Utils         │
                    └─────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- A Web3 wallet (MetaMask recommended)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Environment Variables

```bash
# API Endpoints
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# Blockchain
NEXT_PUBLIC_CHAIN_ID=196
NEXT_PUBLIC_SETTLEMENT_CONTRACT=0x...
NEXT_PUBLIC_PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# Features
NEXT_PUBLIC_ENABLE_DEBUG_MODE=true
```

### Scripts

```bash
# Development
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server

# Code Quality
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues
npm run type-check    # TypeScript type checking

# Testing
npm run test          # Run tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Utilities
npm run clean         # Clean build artifacts
npm run analyze       # Bundle analyzer
```

## Project Structure

```
web/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Home page
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   └── providers.tsx      # Context providers
├── components/            # React components
│   ├── ui/               # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── wallet/           # Wallet components
│   │   ├── WalletConnect.tsx
│   │   └── NetworkSwitcher.tsx
│   ├── intent/           # Intent components
│   │   ├── IntentForm.tsx
│   │   ├── IntentSummary.tsx
│   │   └── IntentHistory.tsx
│   ├── bids/             # Bid components
│   │   ├── BidDisplay.tsx
│   │   ├── BidCard.tsx
│   │   └── BidComparison.tsx
│   └── execution/        # Execution components
│       ├── ExecuteButton.tsx
│       ├── TransactionStatus.tsx
│       └── SuccessDialog.tsx
├── hooks/                # Custom React hooks
│   ├── useIntentFlow.ts  # Main trading flow
│   ├── useSignIntent.ts  # EIP-712 signing
│   ├── useWebSocket.ts   # WebSocket connection
│   └── useTokens.ts      # Token data
├── lib/                  # Utility libraries
│   ├── contracts/        # Contract definitions
│   ├── api/             # API client
│   ├── crypto/          # Cryptographic utilities
│   ├── utils/           # Helper functions
│   └── wagmi/           # Wagmi configuration
└── types/               # TypeScript types
    ├── intent.ts
    ├── bid.ts
    └── api.ts
```

## Key Features

### Intent Creation Flow

```typescript
// 1. User fills out intent form
const intentData = {
  tokenIn: '0x...',
  tokenOut: '0x...',
  amountIn: '1000000000000000000',
  maxSlippageBps: 50,
  deadline: Math.floor(Date.now() / 1000) + 3600,
  receiver: address,
  nonce: generateNonce()
};

// 2. EIP-712 signature request
const signature = await signTypedData({
  domain: EIP712_DOMAIN,
  types: EIP712_TYPES,
  primaryType: 'Intent',
  message: intentData
});

// 3. Submit to backend
const { intentHash } = await submitIntent(intentData, signature);

// 4. Listen for bid updates
const { bids, bestBid } = useWebSocket(intentHash);
```

### Real-time Bid Updates

```typescript
const useWebSocket = (intentHash: string) => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [bestBid, setBestBid] = useState<BidLike | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'BestBidUpdated' && 
          message.data.intentHash === intentHash) {
        setBestBid(message.data.bestBid);
      }
    };

    return () => ws.close();
  }, [intentHash]);

  return { bids, bestBid };
};
```

### Wallet Integration

```typescript
// wagmi configuration
const config = createConfig({
  chains: [xLayer],
  connectors: [
    metaMask(),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID }),
    injected(),
  ],
  transports: {
    [xLayer.id]: http(),
  },
});

// Usage in component
const { address, isConnected } = useAccount();
const { connect, connectors } = useConnect();
const { signTypedData } = useSignTypedData();
```

## Components

### UI Components

**Button Component**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

const Button: FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md',
  loading,
  ...props 
}) => {
  const className = clsx(
    'btn-base',
    `btn-${variant}`,
    `btn-${size}`,
    { 'loading': loading }
  );
  
  return <button className={className} {...props} />;
};
```

**Input Component**
```typescript
interface InputProps {
  label?: string;
  error?: string;
  type?: 'text' | 'number' | 'email';
  placeholder?: string;
}

const Input: FC<InputProps> = ({ label, error, ...props }) => (
  <div className="input-group">
    {label && <label className="input-label">{label}</label>}
    <input className="input-primary" {...props} />
    {error && <span className="input-error">{error}</span>}
  </div>
);
```

### Feature Components

**Intent Form**
```typescript
const IntentForm: FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<IntentFormData>({
    resolver: zodResolver(intentSchema),
  });
  
  const { signIntent, isLoading } = useSignIntent();
  
  const onSubmit = async (data: IntentFormData) => {
    try {
      const result = await signIntent(data);
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TokenSelect
        label="From"
        {...register('tokenIn')}
        error={errors.tokenIn?.message}
      />
      <TokenSelect
        label="To"
        {...register('tokenOut')}
        error={errors.tokenOut?.message}
      />
      <Input
        label="Amount"
        type="number"
        {...register('amountIn')}
        error={errors.amountIn?.message}
      />
      <SlippageInput
        {...register('maxSlippageBps')}
        error={errors.maxSlippageBps?.message}
      />
      <Button type="submit" loading={isLoading}>
        Create Intent
      </Button>
    </form>
  );
};
```

## Styling

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

### Design System

```css
/* Custom CSS utilities */
.btn-primary {
  @apply bg-primary-500 text-white hover:bg-primary-600 px-4 py-2 rounded-md font-medium transition-colors;
}

.card {
  @apply rounded-lg border bg-card text-card-foreground shadow-sm;
}

.input-primary {
  @apply flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm;
}
```

## State Management

```typescript
// Zustand store
interface AppState {
  // Intent state
  currentIntent: Intent | null;
  intentHistory: Intent[];
  
  // Bid state
  activeBids: Record<string, Bid[]>;
  bestBids: Record<string, BidLike>;
  
  // UI state
  isConnecting: boolean;
  activeModal: string | null;
  
  // Actions
  setCurrentIntent: (intent: Intent) => void;
  addBid: (intentHash: string, bid: Bid) => void;
  updateBestBid: (intentHash: string, bid: BidLike) => void;
}

const useAppStore = create<AppState>((set) => ({
  currentIntent: null,
  intentHistory: [],
  activeBids: {},
  bestBids: {},
  isConnecting: false,
  activeModal: null,
  
  setCurrentIntent: (intent) => set({ currentIntent: intent }),
  addBid: (intentHash, bid) => set((state) => ({
    activeBids: {
      ...state.activeBids,
      [intentHash]: [...(state.activeBids[intentHash] || []), bid]
    }
  })),
  updateBestBid: (intentHash, bid) => set((state) => ({
    bestBids: { ...state.bestBids, [intentHash]: bid }
  })),
}));
```

## Testing

### Component Testing

```typescript
// IntentForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { IntentForm } from './IntentForm';

describe('IntentForm', () => {
  it('renders form fields', () => {
    render(<IntentForm />);
    
    expect(screen.getByLabelText(/from token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<IntentForm />);
    
    fireEvent.click(screen.getByRole('button', { name: /create intent/i }));
    
    expect(await screen.findByText(/amount is required/i)).toBeInTheDocument();
  });
});
```

### Hook Testing

```typescript
// useIntentFlow.test.ts
import { renderHook, act } from '@testing-library/react';
import { useIntentFlow } from './useIntentFlow';

describe('useIntentFlow', () => {
  it('creates intent successfully', async () => {
    const { result } = renderHook(() => useIntentFlow());
    
    await act(async () => {
      await result.current.createIntent(mockIntentData);
    });
    
    expect(result.current.currentIntent).toEqual(mockIntentData);
    expect(result.current.isLoading).toBe(false);
  });
});
```

## Performance

### Optimization Strategies

1. **Code Splitting**: Automatic with Next.js App Router
2. **Image Optimization**: Next.js Image component
3. **Bundle Analysis**: `npm run analyze`
4. **Lazy Loading**: Dynamic imports for heavy components
5. **Memoization**: React.memo, useMemo, useCallback

### Performance Metrics

- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **Time to Interactive**: <3s

## Deployment

### Build Configuration

```javascript
// next.config.js
const nextConfig = {
  output: 'export', // For static deployment
  trailingSlash: true,
  images: { unoptimized: true },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Webpack configuration
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};
```

### Deployment Options

**Vercel (Recommended)**
```bash
# Connect GitHub repository to Vercel
# Set environment variables in Vercel dashboard
# Deploy automatically on push to main branch
```

**Static Export**
```bash
npm run build
npm run export
# Deploy `out/` directory to any static host
```

**Docker**
```dockerfile
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Wallet Connection Issues**
   ```typescript
   // Check if wallet is installed
   if (typeof window.ethereum === 'undefined') {
     console.error('No wallet found');
   }
   ```

2. **Network Switching**
   ```typescript
   // Switch to X Layer
   await window.ethereum.request({
     method: 'wallet_switchEthereumChain',
     params: [{ chainId: '0xc4' }], // 196 in hex
   });
   ```

3. **WebSocket Connection**
   ```typescript
   // Add reconnection logic
   const useWebSocket = (url: string) => {
     useEffect(() => {
       const connect = () => {
         const ws = new WebSocket(url);
         ws.onclose = () => setTimeout(connect, 1000);
         return ws;
       };
       const ws = connect();
       return () => ws.close();
     }, [url]);
   };
   ```

4. **Build Errors**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

---

For more information, see the [API Reference](../docs/api-reference.md) and [User Guide](../docs/user-guide.md).