'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';

export function ConnectWalletButton() {
  const [mounted, setMounted] = useState(false);
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  
  // Ensure component is only rendered client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything during SSR or before hydration
  if (!mounted) {
    // Return a placeholder with the same dimensions to prevent layout shift
    return <div className="h-9 w-36"></div>;
  }
  
  // Apply EON's styling to match the app design
  const buttonStyle = "bg-[#7AC488] text-white px-4 py-2 rounded-md font-medium hover:bg-[#68B476] active:bg-[#56A364] transition-colors";
  
  if (isConnected && address) {
    // Show connected state
    return (
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
      </div>
    );
  }
  
  // Show connect button when not connected
  return (
    <button
      type="button"
      className={buttonStyle}
      onClick={() => {
        // Connect using the first available connector (which will be our Farcaster Frame connector)
        if (connectors[0]) {
          connect({ connector: connectors[0] });
        }
      }}
    >
      Connect Wallet
    </button>
  );
}
