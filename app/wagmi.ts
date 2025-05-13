'use client';

import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { farcasterFrame as miniAppConnector } from '@farcaster/frame-wagmi-connector';

// Check environment
const isTestnet = process.env.NEXT_PUBLIC_ENV_TEST === "true";

// Create the Wagmi config following Farcaster Mini Apps docs but with environment-specific chain
export const config = createConfig({
  chains: [isTestnet ? baseSepolia : base],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  connectors: [
    miniAppConnector()
  ]
});
