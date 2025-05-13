import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'viem/chains'
import { farcasterFrame as miniAppConnector } from '@farcaster/frame-wagmi-connector'

// Check environment 
const isTestnet = process.env.NEXT_PUBLIC_ENV_TEST === "true";

// Default chain based on environment
const defaultChain = isTestnet ? baseSepolia : base;

export const config = createConfig({
  chains: [defaultChain],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  connectors: [
    miniAppConnector()
  ]
})
