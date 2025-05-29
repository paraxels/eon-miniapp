"use client";

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useMemo, useState, useEffect } from 'react';

// No global declarations needed

export function WalletConnect() {
  const { isConnected, address, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Initial state - removed excessive console logs
  
  // For debugging - check if auto-connect is disabled
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDisabled = localStorage.getItem('eon_disable_auto_connect') === 'true';
      
      // Reset the flag to enable auto-connection again
      if (isDisabled) {
        localStorage.removeItem('eon_disable_auto_connect');
      }
    }
  }, []);

  // Find the Farcaster Frame connector
  const farcasterConnector = useMemo(() => {
    return connectors.find(c => c.id === 'farcasterFrame' || c.name === 'Farcaster Frame');
  }, [connectors]);

  // Track connection state changes (removed excessive logs)
  useEffect(() => {
    // Connection state tracking
  }, [isConnected, address, connector]);
  
  // Check if auto-connect is allowed
  const [autoConnectAllowed, setAutoConnectAllowed] = useState(() => {
    // Default to true, but check localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eon_disable_auto_connect') !== 'true';
    }
    return true;
  });
  
  // Auto-connect on page load - only if explicitly allowed
  useEffect(() => {
    if (!autoConnectAllowed) {
      return;
    }
    
    // Only attempt to connect if we have connectors and are not already connected
    if (connectors.length > 0 && !isConnected) {
      try {
        // Use a timeout to ensure this runs after initial render
        setTimeout(() => {
          connect({ connector: connectors[0] });
        }, 300);
      } catch (error) {
        console.error('[WALLET] Auto-connect failed:', error);
      }
    }
  }, [connectors, isConnected, connect, autoConnectAllowed]);

  // Effect for handling disconnect state
  useEffect(() => {
    if (isDisconnecting && !isConnected) {
      setIsDisconnecting(false);
      // No page reload needed - React state should handle UI updates
    }
  }, [isConnected, isDisconnecting]);
  
  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the dropdown is open and the click wasn't on a dropdown element
      if (showDropdown && !(event.target as Element).closest('.wallet-dropdown-container')) {
        setShowDropdown(false);
      }
    };
    
    // Only add listener when dropdown is shown
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    
    // Cleanup
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown]);

  // Custom disconnect function that works better with Farcaster frames
  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setShowDropdown(false);
      
      // Try standard disconnect first
      await disconnect();
      
      // Disable auto-connect permanently in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('eon_disable_auto_connect', 'true');
        setAutoConnectAllowed(false);
      }
      
      // Extra handling for Coinbase Wallet in Farcaster frames
      if (typeof window !== 'undefined' && window.localStorage) {
        // Clear relevant connection data from localStorage
        const keysToRemove = ['wagmi.connected', 'wagmi.wallet', 'wagmi.account', 'wagmi.injected.shimDisconnect'];
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.error(`Failed to remove ${key} from localStorage`, e);
          }
        });
      }
      
      // Slight delay to allow state updates
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 100);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setIsDisconnecting(false);
    }
  };

  if (isConnected && address) {
    return (
      <div className="relative wallet-dropdown-container">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center px-3 py-1.5 rounded-md border border-gray-200"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
        </button>
        
        {showDropdown && (
          <div className="absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-2 w-60 z-10">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 font-medium">Connected Wallet</p>
              <p className="text-sm font-mono break-all">{address}</p>
              {connector && (
                <p className="text-xs text-gray-500 mt-1">via {connector.name}</p>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50 disabled:opacity-50"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect Wallet'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        try {
          if (farcasterConnector) {
            connect({ connector: farcasterConnector });
          } else if (connectors.length > 0) {
            // Fallback to the first connector if Farcaster connector is not found
            connect({ connector: connectors[0] });
          }
        } catch (err) {
          console.error('Connection error:', err);
        }
      }}
      className="bg-[#7AC488] text-white px-4 py-2 rounded-md font-medium hover:bg-[#68B476] active:bg-[#56A364] transition-colors"
    >
      Connect Wallet
    </button>
  );
}
