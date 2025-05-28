"use client";

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useMemo, useState, useEffect, useRef } from 'react';

// No global declarations needed

export function WalletConnect() {
  const { isConnected, address, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Create refs for the dropdown and button
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Console log on initial render
  console.log('[WALLET] Initial render:', { 
    isConnected, 
    address, 
    connectorName: connector?.name,
    availableConnectors: connectors.map(c => c.name)
  });

  // Find the Farcaster Frame connector
  const farcasterConnector = useMemo(() => {
    const connector = connectors.find(c => c.id === 'farcasterFrame' || c.name === 'Farcaster Frame');
    console.log('[WALLET] Farcaster connector found:', connector?.name || 'Not found');
    return connector;
  }, [connectors]);

  // Log when connection state changes
  useEffect(() => {
    console.log('[WALLET] Connection state changed:', { 
      isConnected, 
      address, 
      connectorName: connector?.name 
    });
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
      console.log('[WALLET] Auto-connect disabled by user preference');
      return;
    }
    
    // Only attempt to connect if we have connectors and are not already connected
    if (connectors.length > 0 && !isConnected) {
      console.log('[WALLET] Auto-connecting with first available connector:', connectors[0].name);
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
      console.log('[WALLET] Disconnect complete');
      setIsDisconnecting(false);
      // No page reload needed - React state should handle UI updates
    }
  }, [isConnected, isDisconnecting]);
  
  // Click outside handler to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // If dropdown is shown and click is outside dropdown and button
      if (
        showDropdown && 
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        console.log('[WALLET] Click outside detected, closing dropdown');
        setShowDropdown(false);
      }
    }
    
    // Add event listener when dropdown is shown
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Custom disconnect function that works better with Farcaster frames
  const handleDisconnect = async () => {
    try {
      console.log('[WALLET] Starting disconnect process');
      setIsDisconnecting(true);
      setShowDropdown(false);
      
      // Try standard disconnect first
      await disconnect();
      console.log('[WALLET] Standard disconnect completed');
      
      // Disable auto-connect permanently in localStorage
      if (typeof window !== 'undefined') {
        console.log('[WALLET] Disabling auto-connect in localStorage');
        localStorage.setItem('eon_disable_auto_connect', 'true');
        setAutoConnectAllowed(false);
      }
      
      // Extra handling for Coinbase Wallet in Farcaster frames
      if (typeof window !== 'undefined' && window.localStorage) {
        console.log('[WALLET] Cleaning up localStorage items');
        // Clear relevant connection data from localStorage
        const keysToRemove = ['wagmi.connected', 'wagmi.wallet', 'wagmi.account', 'wagmi.injected.shimDisconnect'];
        keysToRemove.forEach(key => {
          try {
            const hasKey = localStorage.getItem(key) !== null;
            console.log(`[WALLET] ${key} exists: ${hasKey}`);
            localStorage.removeItem(key);
          } catch (e) {
            console.error(`[WALLET] Failed to remove ${key} from localStorage`, e);
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
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center px-3 py-1.5 rounded-md border border-gray-200"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
        </button>
        
        {showDropdown && (
          <div 
            ref={dropdownRef}
            className="absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-2 w-60 z-10">
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
        console.log('[WALLET] Connect button clicked');
        try {
          if (farcasterConnector) {
            console.log('[WALLET] Connecting with Farcaster connector');
            connect({ connector: farcasterConnector });
            console.log('[WALLET] Connection attempt initiated');
          } else if (connectors.length > 0) {
            // Fallback to the first connector if Farcaster connector is not found
            console.log('[WALLET] Connecting with fallback connector:', connectors[0].name);
            connect({ connector: connectors[0] });
            console.log('[WALLET] Connection attempt initiated');
          }
        } catch (err) {
          console.error('[WALLET] Connection error:', err);
        }
      }}
      className="bg-[#7AC488] text-white px-4 py-2 rounded-md font-medium hover:bg-[#68B476] active:bg-[#56A364] transition-colors"
    >
      Connect Wallet
    </button>
  );
}
