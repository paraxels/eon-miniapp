import { OnchainKitProvider } from '@coinbase/onchainkit';
import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // Check environment to determine which chain to use
  const isTestnet = process.env.NEXT_PUBLIC_ENV_TEST === "true";
  
  // Define complete chain configurations
  const baseMainnet = {
    id: 8453,
    name: 'Base',
    network: 'base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: ['https://mainnet.base.org']
      },
      public: {
        http: ['https://mainnet.base.org']
      }
    },
    blockExplorers: {
      default: {
        name: 'BaseScan',
        url: 'https://basescan.org'
      }
    }
  };

  const baseSepolia = {
    id: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: ['https://sepolia.base.org']
      },
      public: {
        http: ['https://sepolia.base.org']
      }
    },
    blockExplorers: {
      default: {
        name: 'BaseScan',
        url: 'https://sepolia.basescan.org'
      }
    },
    testnet: true
  };

  // Select chain based on environment
  const chainConfig = isTestnet ? baseSepolia : baseMainnet;

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={chainConfig}
      config={{
        appearance: {
          name: 'EON',
          logo: process.env.NEXT_PUBLIC_ICON_URL || '',
          mode: 'auto',
          theme: 'default',
        },
        wallet: {
          display: 'modal',
          termsUrl: 'https://eon.com/terms',
          privacyUrl: 'https://eon.com/privacy',
          supportedWallets: {
            rabby: true,
            trust: true,
            frame: true,
            // MetaMask is enabled by default as injected wallet
          },
        },
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}
