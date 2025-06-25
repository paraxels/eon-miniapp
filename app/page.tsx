/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { useOpenUrl } from "@coinbase/onchainkit/minikit";
import { sdk } from "@farcaster/frame-sdk";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "./components/DemoComponents";
import { Icon } from "./components/DemoComponents";
import { SeasonRecapCard } from "./components/SeasonRecapCard";
import { WagmiProviderComponent } from "./components/WagmiProvider";
import { WalletConnect } from "./components/WalletConnect";
import { useAccount, useConnect, useSendTransaction, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import { base, baseSepolia } from "wagmi/chains";

// Add TypeScript declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ERC20 ABI for the approve function and balanceOf
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [
      { name: "account", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
];

// USDC token addresses
const USDC_ADDRESSES = {
  mainnet: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  testnet: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
};

// Etherscan URLs
const ETHERSCAN_URLS = {
  mainnet: "https://etherscan.io",
  testnet: "https://sepolia.etherscan.io"
};

// Spender addresses
const SPENDER_ADDRESSES = {
  mainnet: "0x49E0575D4aAc65C1FEE53FF1458B03dB14c3F82F",
  testnet: "0x66B5700036D7E397F721192fA06E17f9c0515F7f" // Using same address for both environments for now
};

// Check environment
const isTestnet = process.env.NEXT_PUBLIC_ENV_TEST === "true";
const USDC_ADDRESS = isTestnet ? USDC_ADDRESSES.testnet : USDC_ADDRESSES.mainnet;
const ETHERSCAN_URL = isTestnet ? ETHERSCAN_URLS.testnet : ETHERSCAN_URLS.mainnet;
const SPENDER_ADDRESS = isTestnet ? SPENDER_ADDRESSES.testnet : SPENDER_ADDRESSES.mainnet;

// App Content component
function AppContent() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const openUrl = useOpenUrl();
  const [frameAdded, setFrameAdded] = useState(false);
  const [amount, setAmount] = useState(5);
  const [percentage, setPercentage] = useState(10);
  const [isApproving, setIsApproving] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [showTxMessage, setShowTxMessage] = useState(false);
  const [error, setError] = useState("");
  const [userFid, setUserFid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Modal state for custom dialogs (replacing alert/confirm)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'alert' | 'confirm' | 'info'>('alert');
  // For tracking action type and data
  const [actionType, setActionType] = useState<string>('');
  const [actionData, setActionData] = useState<any>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  // Tab state for 'Seasons' (default) and 'Campaigns'
  const [selectedTab, setSelectedTab] = useState<'seasons' | 'campaigns'>('seasons');
  // State to track if campaign search is active
  const [showCampaignSearch, setShowCampaignSearch] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [campaignStep, setCampaignStep] = useState<'profile' | 'finalize'>('profile');
  const [campaignDonation, setCampaignDonation] = useState(1);
  const [campaignGoal, setCampaignGoal] = useState(5);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [showNotEnoughUsdcError, setShowNotEnoughUsdcError] = useState(false);
  const [showGoalUsdcError, setShowGoalUsdcError] = useState(false);
  const [showSeasonsUsdcError, setShowSeasonsUsdcError] = useState(false);
  
  // Function to handle showing and fading the USDC error message
  const showUsdcErrorMessage = () => {
    setShowNotEnoughUsdcError(true);
    setTimeout(() => setShowNotEnoughUsdcError(false), 1250);
  };
  
  // Function to handle showing and fading the goal USDC error message
  const showGoalUsdcErrorMessage = () => {
    setShowGoalUsdcError(true);
    setTimeout(() => setShowGoalUsdcError(false), 1250);
  };
  
  // Function to handle showing and fading the seasons USDC error message
  const showSeasonsUsdcErrorMessage = () => {
    setShowSeasonsUsdcError(true);
    setTimeout(() => setShowSeasonsUsdcError(false), 1250);
  };
  
  // Function to search organizations using our proxy API
  const searchOrganizations = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Use our local API proxy to avoid CORS issues
      const response = await fetch(`/api/proxy-search?searchTerm=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Search request failed');
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounce search to prevent too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showCampaignSearch) {
        searchOrganizations(campaignSearch);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [campaignSearch, showCampaignSearch]);
  
  // Get addFrame from MiniKit
  const addFrame = useAddFrame();
  
  // Define handleAddFrame at the top of the component
  const handleAddFrame = useCallback(async () => {
    console.log('Attempting to add frame...');
    try {
      console.log('Context state before addFrame:', {
        contextClient: context?.client,
        clientAdded: context?.client?.added,
        userFid,
        userProfileState: userProfile ? {
          shownAddMiniappPrompt: userProfile.shownAddMiniappPrompt,
          hasWallet: Boolean(userProfile.wallet)
        } : null
      });
      
      const frameAdded = await addFrame();
      console.log('addFrame result:', frameAdded);
      setFrameAdded(Boolean(frameAdded));
      return Boolean(frameAdded); // Return boolean result for use in other functions
    } catch (error) {
      console.error('Error adding frame:', error);
      return false;
    }
  }, [addFrame, context, userFid, userProfile]);
  
  // Get account info from Wagmi
  const { isConnected, address, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  
  // Define interface for database records
  interface DatabaseRecord {
    _id: string;
    fid: string;
    walletAddress: string;
    transactionHash: string;
    dollarAmount: number;
    percentAmount: number;
    authorized: string;
    active: boolean;
    completed?: boolean;
    target: string;
    timestamp: string;
    network: string;
  }
  
  // Interface for donation progress data
  interface DonationProgress {
    totalDonated: number; // in cents
    transactionCount: number;
    transactions: Array<{
      txHash: string;
      donationTxHash: string;
      amount: string;
      timestamp: string | number;
    }>;
  }
  
  // State for existing records
  const [existingRecord, setExistingRecord] = useState<DatabaseRecord | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  
  // State for most recent completed record
  const [completedRecord, setCompletedRecord] = useState<DatabaseRecord | null>(null);
  
  // State for donation progress
  const [donationProgress, setDonationProgress] = useState<DonationProgress | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  
  // State for total donations
  const [totalDonations, setTotalDonations] = useState<{totalDonated: number, transactionCount: number} | null>(null);
  const [isLoadingTotalDonations, setIsLoadingTotalDonations] = useState(false);
  
  // State for transaction record count
  const [transactionRecordCount, setTransactionRecordCount] = useState<number | null>(null);
  
  // Create transaction hooks
  const { data: hash, error: sendError, isPending: isSending, sendTransaction } = useSendTransaction();
  
  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ 
    hash,
  });

  // Chain switching
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  // Function to manage user profile - consolidated create/update/fetch into one function
  // Memoized to prevent unnecessary re-renders
  const manageUserProfile = useCallback(async (fid: string, username?: string, wallet?: string, updatePromptShown?: boolean) => {
    if (!fid) return null;
    
    try {
      console.log('Managing user profile for FID:', fid);
      
      // Skip separate fetch call and just use POST to create/update
      // The API now handles this with upsert functionality
      const response = await fetch('/api/user-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid,
          username,
          wallet,
          ...(updatePromptShown ? { shownAddMiniappPrompt: true } : {})
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`User profile ${data.isNewProfile ? 'created' : 'updated'}:`, data.profile);
        setUserProfile(data.profile);
        return data.profile;
      } else {
        console.error('Error managing user profile:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Failed to manage user profile:', error);
      return null;
    }
  }, []);
  
  // Function to update user profile prompt flag
  const updatePromptShown = useCallback(async (fid: string) => {
    if (!fid) return;
    
    // Don't update if we've already tried to update or if userProfile already has shownAddMiniappPrompt set to true
    if (userProfile?.shownAddMiniappPrompt === true) {
      console.log('Skipping prompt update - already marked as shown');
      return;
    }
    
    console.log('Updating add miniapp prompt flag in database...');
    try {
      const response = await fetch('/api/user-profiles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid,
          shownAddMiniappPrompt: true
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Successfully updated prompt flag in database');
        // Update local state
        setUserProfile((prev: any) => {
          if (!prev) return null;
          return {...prev, shownAddMiniappPrompt: true};
        });
      }
    } catch (error) {
      console.error('Failed to update prompt shown flag:', error);
    }
  }, [userProfile]);

  // Effect to get the user's FID from the MiniKit context
  useEffect(() => {
    if (context) {
      console.log('Farcaster context loaded:', context);
      
      // Extract username from context if available
      let username: string | undefined;
      if (context.user?.username) {
        username = context.user.username;
      } else if ((context as any)?.client?.user?.username) {
        username = (context as any).client.user.username;
      }
      
      if (username) {
        console.log('Found username:', username);
      }
      
      // Direct access to user.fid which is shown in the logs
      if (context.user?.fid) {
        const fid = context.user.fid;
        console.log('Found user FID:', fid);
        setUserFid(String(fid));
      } else {
        // Fallback checks for other possible locations
        const fid = (context as any)?.message?.data?.fid || 
                   (context as any)?.frame?.data?.fid || 
                   (context as any)?.client?.user?.fid;
        
        if (fid) {
          console.log('Found user FID in alternate location:', fid);
          setUserFid(String(fid));
        } else {
          console.log('No FID found in context. Full context:', JSON.stringify(context, null, 2));
        }
      }
    }
  }, [context]);
  
  // Use a ref instead of state to track prompt attempts to prevent re-renders
  const hasTriedPromptRef = useRef(false);
  
  // Create a separate effect specifically for the auto frame adding with safeguards
  useEffect(() => {
    // Only run this effect if we have both the user profile and the FID
    // AND we haven't already tried to prompt the user in this session
    if (userProfile && userFid && context && !hasTriedPromptRef.current) {
      console.log('Frame adding conditions check:', {
        hasUserProfile: Boolean(userProfile),
        hasUserFid: Boolean(userFid),
        hasContext: Boolean(context),
        hasTriedPrompt: hasTriedPromptRef.current,
        shownAddMiniappPrompt: userProfile?.shownAddMiniappPrompt,
        clientAdded: context?.client?.added
      });
      
      // Check if we need to show the add miniapp prompt
      if (userProfile.shownAddMiniappPrompt === false && !context.client?.added) {
        console.log('First visit detected, automatically prompting to add frame');
        console.log('Full context object:', JSON.stringify(context, null, 2));
        
        // Mark that we've attempted to show the prompt in this session
        hasTriedPromptRef.current = true;
        
        // Small delay to ensure UI is ready
        const promptTimeoutId = setTimeout(() => {
          console.log('Timeout fired, calling handleAddFrame...');
          
          handleAddFrame()
            .then(added => {
              console.log('handleAddFrame promise resolved with:', added);
              if (added) {
                // Update the user profile to indicate prompt was shown
                console.log('Updating prompt shown flag...');
                updatePromptShown(userFid);
              } else {
                console.log('Frame was not added, updating prompt shown flag');
                updatePromptShown(userFid);
              }
            })
            .catch(error => {
              console.error('Error in handleAddFrame promise chain:', error);
            });
        }, 100);
        
        return () => clearTimeout(promptTimeoutId);
      } else {
        // Even if we don't prompt, still mark this session as having checked
        hasTriedPromptRef.current = true;
        console.log('Not showing prompt because:', {
          shownAddMiniappPromptIsFalse: userProfile.shownAddMiniappPrompt === false,
          contextClientAddedIsTrue: Boolean(context.client?.added)
        });
      }
    }
  }, [userProfile, userFid, context, handleAddFrame, updatePromptShown]);
  
  // Use ref to track basic profile initialization (without wallet)
  const hasInitializedBasicProfile = useRef(false);
  // Use ref to track if we've already associated this wallet
  const lastAssociatedWallet = useRef<string | null>(null);
  
  // Consolidated effect to manage user profile when user identity is available
  useEffect(() => {
    // Only proceed if we have a Farcaster ID
    if (userFid) {
      // Extract username from context if available
      let username: string | undefined;
      if (context?.user?.username) {
        username = context.user.username;
      } else if ((context as any)?.client?.user?.username) {
        username = (context as any).client.user.username;
      }
      
      // Check if we need to do initial profile setup
      if (!hasInitializedBasicProfile.current) {
        console.log('Initial basic profile setup for session - FID:', userFid);
        hasInitializedBasicProfile.current = true;
        
        // Initialize profile (with wallet if connected)
        const wallet = isConnected && address ? address : undefined;
        manageUserProfile(userFid, username, wallet);
        
        // Track last associated wallet if one was used
        if (wallet) {
          lastAssociatedWallet.current = wallet;
        }
        return;
      }
      
      // Handle wallet connection/change after initial profile setup
      if (isConnected && address) {
        // Only update if this is a different wallet than previously associated
        if (address !== lastAssociatedWallet.current) {
          console.log('Associating new wallet with profile:', address);
          manageUserProfile(userFid, username, address);
          lastAssociatedWallet.current = address;
        }
      }
    }
  }, [userFid, context, isConnected, address, manageUserProfile]);

  // Custom theme colors
  const themeStyles = {
    "--app-accent": "#508F68",       // Slightly darker green
    "--app-accent-hover": "#55A063", // Adjusted hover state
    "--app-accent-active": "#478F53", // Adjusted active state
    "--app-card-background": "#FAFAF0",
  } as React.CSSProperties;

  // addFrame and handleAddFrame are already defined at the top of the component

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  useEffect(() => {
    if (hash) {
      setTxHash(hash);
      setShowTxMessage(true);
      
      // Set a timer to fade out the transaction message after 5 seconds
      const timer = setTimeout(() => {
        setShowTxMessage(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [hash]);
  
  // Function to fetch total donations
  const fetchTotalDonations = async () => {
    try {
      setIsLoadingTotalDonations(true);
      const cacheBuster = Date.parse(new Date().toString());
      const response = await fetch(`/api/total-donations?timestamp=${cacheBuster}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log(`Total donations across all users: ${data.totalDonated} base units ($${(data.totalDonated/1000000).toFixed(2)} USDC)`);
        setTotalDonations(data);
        setTransactionRecordCount(data.transactionCount); // Set transactionCount from total-donations
      } else {
        console.error('Error fetching total donations:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch total donations:', error);
    } finally {
      setIsLoadingTotalDonations(false);
    }
  };

  // Simple toggle for recap vs. active season card
   // Only declare once

  // Bulletproof recap trigger: checks all available data
  const checkAndTriggerRecap = useCallback(() => {
    // Use completedRecord if available
    if (
      completedRecord &&
      completedRecord._id &&
      (completedRecord.completed === true || completedRecord.active === false)
    ) {
      setCompletedRecord({ ...completedRecord, active: false, completed: true });
      
      return;
    }
    // Use donationProgress + existingRecord if available
    if (existingRecord && donationProgress && existingRecord._id) {
      const seasonGoal = existingRecord.dollarAmount || 0;
      const seasonStart = new Date(existingRecord.timestamp).getTime();
      const filteredTxs = (donationProgress.transactions || []).filter((tx: any) => {
        const txTime = new Date(tx.timestamp).getTime();
        return txTime >= seasonStart;
      });
      let runningTotal = 0;
      for (const tx of filteredTxs) {
        if (runningTotal >= seasonGoal * 1_000_000) break;
        const amt = Number(tx.amount);
        runningTotal += amt;
      }
      const donatedDollars = runningTotal / 1_000_000;
      if (
        donatedDollars >= seasonGoal &&
        seasonGoal > 0
      ) {
        setCompletedRecord({ ...existingRecord, active: false, completed: true });
        
      }
    }
  }, [completedRecord, existingRecord, donationProgress]);

  // Effect to fetch total donations and wallet donation progress every 5 seconds
  useEffect(() => {
    let isMounted = true;
    // Helper to fetch both total and wallet-specific donations
    const poll = async () => {
      await fetchTotalDonations();
      // Only check for user donations if wallet is connected and active record exists
      if (address && existingRecord && existingRecord.timestamp) {
        try {
          const response = await fetch(`/api/donation-progress?address=${address}`);
          const data = await response.json();
          if (response.ok && data.success) {
            // Only update if new donations (by totalDonated or transaction count)
            const newDonations =
              (!donationProgress) ||
              (data.totalDonated !== donationProgress.totalDonated) ||
              (data.transactionCount !== donationProgress.transactionCount);
            if (newDonations) {
              setDonationProgress(data);
            }
            // Always check for recap after donation progress update
            setTimeout(checkAndTriggerRecap, 0); // Defer to next tick to ensure state is updated

          } else {
            console.error('Error fetching donation progress:', data.error);
          }
        } catch (error) {
          console.error('Failed to fetch donation progress:', error);
        }
      }
    };
    poll(); // Initial fetch
    const interval = setInterval(poll, 5000); // Refetch every 5 seconds
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [address, existingRecord, donationProgress, ]);

  // Function to fetch USDC balance
  const fetchUsdcBalance = async (walletAddress: string) => {
    if (!walletAddress) return;
    
    try {
      // Use ethers.js or viem to get the USDC balance
      const response = await fetch(`/api/token-balance?address=${walletAddress}&token=${USDC_ADDRESS}`);
      const data = await response.json();
      
      if (response.ok && data.balance) {
        // Convert from wei (assuming 6 decimals for USDC)
        const balanceInUsdc = (parseInt(data.balance) / 1000000).toFixed(2);
        console.log(`USDC Balance: ${balanceInUsdc}`);
        setUsdcBalance(balanceInUsdc);
      }
    } catch (error) {
      console.error('Failed to fetch USDC balance:', error);
    }
  };
  
  // Effect to fetch existing active records when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      // Fetch USDC balance when wallet connects
      fetchUsdcBalance(address);
      const fetchExistingRecords = async () => {
        try {
          setIsLoadingRecord(true);
          const response = await fetch(`/api/wallet-records?address=${address}`);
          const data = await response.json();
          
          if (response.ok && data.success) {
            if (data.hasActiveRecord) {
              console.log('Found existing active record:', data.record);
              setExistingRecord(data.record);
              setCompletedRecord(null);
              setTimeout(checkAndTriggerRecap, 0);
              // Pre-populate the UI with values from the record
              if (data.record.dollarAmount) {
                setAmount(data.record.dollarAmount);
              }
              if (data.record.percentAmount) {
                setPercentage(data.record.percentAmount);
              }
              // Now fetch donation progress for this address
              fetchDonationProgress(address);
            } else {
              // No active record, try to fetch most recent completed record
              setExistingRecord(null);
              try {
                const completedResp = await fetch(`/api/wallet-records?address=${address}&completed=true`);
                const completedData = await completedResp.json();
                if (
                  completedResp.ok &&
                  completedData.hasCompletedRecord &&
                  completedData.record &&
                  completedData.record.completed === true &&
                  completedData.record.active === false
                ) {
                  console.log('Found completed record:', completedData.record);
                  setCompletedRecord(completedData.record);
                  setTimeout(checkAndTriggerRecap, 0);
                } else {
                  console.log('No completed record or does not match criteria:', completedData);
                  setCompletedRecord(null);
                }
              } catch (err) {
                setCompletedRecord(null);
              }
            }
          } else {
            console.error('Error fetching wallet records:', data.error);
          }
        } catch (error) {
          console.error('Failed to fetch wallet records:', error);
        } finally {
          setIsLoadingRecord(false);
        }
      };
      
      fetchExistingRecords();
    } else {
      // Reset if wallet disconnects
      setExistingRecord(null);
      setDonationProgress(null);
    }
  }, [isConnected, address]);
  
  // Function to fetch donation progress
  const fetchDonationProgress = async (walletAddress: string) => {
    if (!walletAddress) return;
    
    try {
      console.log(`Fetching donation progress for wallet address: ${walletAddress}`);
      setIsLoadingProgress(true);
      
      // Normalize the address format to match exactly what's in the sample data
      // Let's try with the address as-is first
      const normalizedAddress = walletAddress; // We'll keep this as-is
      console.log('Using normalized address:', normalizedAddress);
      
      const response = await fetch(`/api/donation-progress?address=${normalizedAddress}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Donation progress data received:', data);
        console.log(`Total donated: ${data.totalDonated} base units ($${(data.totalDonated/1000000).toFixed(2)} USDC)`);
        console.log(`Transaction count: ${data.transactionCount}`);
        if (data.transactions) {
          console.log('Individual transactions:', data.transactions);
        }
        
        // Additional debug info for the progress bar
        const goalAmount = existingRecord?.dollarAmount || 0;
        const progressPercentage = goalAmount > 0 ? 
          Math.min(100, (data.totalDonated / 1000000) / goalAmount * 100) : 0;
          
        console.log(`Goal amount: $${goalAmount}`);
        console.log(`Progress percentage: ${progressPercentage.toFixed(2)}%`);
        
        setDonationProgress(data);
      } else {
        console.error('Error fetching donation progress:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch donation progress:', error);
    } finally {
      setIsLoadingProgress(false);
    }
  };
  
  useEffect(() => {
    if (isConfirmed) {
      setIsApproving(false);
    }
  }, [isConfirmed]);
  
  useEffect(() => {
    if (sendError) {
      setError(sendError.message || "Transaction failed");
      setIsApproving(false);
    }
  }, [sendError]);

  interface TransactionRecord {
    dollarAmount: number;
    percentAmount: number;
    active?: boolean;
    target?: string;
  }
  
  const [transactionToRecord, setTransactionToRecord] = useState<TransactionRecord | null>(null);

  const TEST_TARGET_ADDRESS = "0xa65d8A8Cf67795B375FAFb97C3627d59A4d73efB";
  const PROD_TARGET_ADDRESS = "0x8d2a84300d6ce230ed3fffc23dbcdf1e6c781ff0"; // Can update later

  useEffect(() => {
    if (isConfirmed && hash && address && transactionToRecord) {
      const saveTxRecord = async () => {
        try {
          const spenderAddress = SPENDER_ADDRESS; // Use the constant instead of hardcoded value
          const targetAddress = isTestnet ? TEST_TARGET_ADDRESS : PROD_TARGET_ADDRESS;
          
          console.log('Transaction confirmed, saving record to MongoDB...', {
            hash,
            address,
            dollarAmount: transactionToRecord.dollarAmount,
            percentAmount: transactionToRecord.percentAmount,
            spender: spenderAddress,
            fid: userFid || 'unknown',
            active: true,
            target: targetAddress
          });
          
          const recordData = {
            fid: userFid || 'unknown',
            walletAddress: address,
            transactionHash: hash,
            dollarAmount: transactionToRecord.dollarAmount,
            percentAmount: transactionToRecord.percentAmount,
            authorized: spenderAddress,
            active: true,
            target: targetAddress
          };
          
          const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(recordData),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            console.error('Failed to save transaction record:', data.error);
          } else {
            console.log('Transaction record saved successfully');
            setTransactionToRecord(null);
            
            // Create a local DatabaseRecord object from the newly saved record
            // This allows us to immediately show the active season view without a round trip to the server
            if (data.record) {
              setExistingRecord(data.record);
            } else {
              // If the API doesn't return the full record, construct one from our data
              const newRecord: DatabaseRecord = {
                _id: data.insertedId,
                ...recordData,
                timestamp: new Date().toISOString(),
                network: isTestnet ? 'base-sepolia' : 'base-mainnet'
              };
              setExistingRecord(newRecord);
            }
          }
        } catch (error) {
          console.error('Error saving transaction record:', error);
        }
      };
      
      saveTxRecord();
    }
  }, [isConfirmed, hash, address, transactionToRecord, userFid, isTestnet]);

  useEffect(() => {
    if (isConfirmed && hash && !transactionToRecord) {
      console.log('Transaction confirmed but not marked for recording. Skipping database recording.');
    }
  }, [isConfirmed, hash, transactionToRecord]);

  // Removed duplicate handleAddFrame function

  const increaseAmount = () => {
    // If would exceed balance, show error message
    if (wouldExceedBalance) {
      showSeasonsUsdcErrorMessage();
      return;
    }
    setAmount(prev => prev + 1);
  };
  
  // Check if increasing amount would exceed USDC balance
  const wouldExceedBalance = (amount + 1) > parseFloat(usdcBalance);
  
  // CSS classes for disabled button
  const disabledButtonClass = "opacity-30 cursor-not-allowed";
  
  // Check if campaign donation increase would exceed balance
  const wouldCampaignDonationExceedBalance = (campaignDonation + 1) > parseFloat(usdcBalance);
  
  // Check if campaign goal increase would exceed balance
  const wouldCampaignGoalExceedBalance = (campaignGoal + 1) > parseFloat(usdcBalance);

  const decreaseAmount = () => {
    setAmount(prev => prev > 1 ? prev - 1 : 1);
  };

  const increasePercentage = () => {
    setPercentage(prev => {
      if (prev >= 20) {
        return prev + 5;
      }
      return prev + 1;
    });
  };

  const decreasePercentage = () => {
    setPercentage(prev => {
      if (prev > 20) {
        return prev - 5;
      }
      return prev > 1 ? prev - 1 : 1;
    });
  };

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4"
          icon={<Icon name="plus" size="sm" />}
        >
          Save Frame
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[var(--app-accent)] animate-fade-out">
          <Icon name="check" size="sm" className="text-[var(--app-accent)]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  const handleApprove = async () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }
    
    setIsApproving(true);
    setError("");
    
    try {
      const targetChainId = isTestnet ? baseSepolia.id : base.id;
      
      if (chainId !== targetChainId) {
        try {
          await switchChain({ chainId: targetChainId });
        } catch (switchError) {
          console.error("Failed to switch chain:", switchError);
          setError(`Please switch to ${isTestnet ? "Base Sepolia" : "Base"} network in your wallet`);
          setIsApproving(false);
          return;
        }
      }
      
      setTransactionToRecord({
        dollarAmount: amount,
        percentAmount: percentage
      });
      
      const amountInWei = parseUnits(amount.toString(), 6);
      
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SPENDER_ADDRESS as `0x${string}`, amountInWei]
      });
      
      sendTransaction({
        to: USDC_ADDRESS as `0x${string}`,
        data,
        chainId: targetChainId,
      });
      
    } catch (err) {
      const errorMessage = (err as Error).message || "Error during approval";
      console.error("Error during approval:", err);
      setError(errorMessage);
      setIsApproving(false);
      setTransactionToRecord(null);
    }
  };


  const [showRecap, setShowRecap] = useState(true);

  // Share handler for Farcaster cast
  const handleShare = async () => {
    if (!completedRecord) return;
    const seasonTotal = completedRecord.dollarAmount;
    const totalRaised = totalDonations ? (totalDonations.totalDonated / 1000000).toFixed(2) : '0.00';
    const castText = `The amazing people on fracaster have raised $${totalRaised} for charity by passively donating a percent of what they earn on this app through EON. No amount is too small to make a difference, will you join in?`;

    try {
      // Use sdk.actions.composeCast as per documentation
      await sdk.actions.composeCast({ 
        text: castText,
        embeds: ["https://eon-miniapp.vercel.app/"] 
      });
    } catch (err) {
      console.error('Failed to compose cast:', err);
    }
  }

  // Hide recap and show new season card when triggered
  if (completedRecord && completedRecord.active === false && completedRecord.completed === true && showRecap) {
    return (
      <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)]" style={{ ...themeStyles, backgroundColor: "#F7F6E7", background: "#F7F6E7" }}>
        <div className="w-full max-w-md mx-auto px-4 py-3" style={{ backgroundColor: "#F7F6E7" }}>
          <header className="flex justify-between items-center mb-3 h-11">
            <div>
              <div className="flex items-center space-x-2">
                <WalletConnect />
              </div>
            </div>
            <div>{saveFrameButton}</div>
          </header>

          <div className="text-center my-8">
          <h1 className="text-6xl" style={{ fontFamily: 'var(--font-custom)', letterSpacing: '0.2em', color: '#5FA578' }}>EON</h1>
          <p className="text-lg text-[var(--app-foreground-muted)]">compound your impact for the longterm</p>
          {/* Total donations counter */}
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="text-sm font-medium text-[var(--app-accent)]">
              {totalDonations ? (
                <span>${(totalDonations.totalDonated / 1000000).toFixed(2)} donated</span>
              ) : (
                <span>$0.00 donated</span>
              )}
            </div>
            <div className="w-px h-5 bg-[var(--app-accent)] opacity-30"></div>
            <div className="text-sm font-medium text-[var(--app-accent)]">
              {transactionRecordCount ? (
                <span>{transactionRecordCount} donations</span>
              ) : (
                <span>No donations</span>
              )}
            </div>
          </div>
          
          
          <div className="flex mb-6 justify-center">
            <button 
              onClick={() => {
                setModalType('info');
                setModalMessage('About EON');
                setModalOpen(true);
              }}
              className="text-[var(--app-foreground-muted)] text-xs cursor-pointer font-medium flex items-center"
            >
              How it works
              <svg className="ml-1" fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="10" height="10">
                <circle cx="20" cy="20" r="19" stroke="#000" stroke-width="2" fill="none" />
                <g transform="scale(0.8) translate(2.5,2.5)">
                  <path d="M24.733,34.318c-0.936,0-1.73,0.322-2.375,0.947c-0.645,0.627-0.968,1.414-0.968,2.338c0,1.035,0.334,1.85,1,2.429 c0.667,0.581,1.449,0.862,2.342,0.862c0.868,0,1.631-0.297,2.295-0.881c0.656-0.582,0.988-1.395,0.988-2.41 c0-0.924-0.32-1.711-0.953-2.338C26.439,34.641,25.657,34.318,24.733,34.318z"/>
                  <path d="M30.896,8.772c-1.631-0.791-3.51-1.18-5.629-1.18c-2.295,0-4.294,0.473-6.005,1.401c-1.718,0.943-3.026,2.126-3.919,3.562 C14.45,13.978,14,15.394,14,16.787c0,0.67,0.281,1.295,0.848,1.889c0.561,0.565,1.258,0.861,2.076,0.861 c1.395,0,2.342-0.832,2.844-2.488c0.527-1.574,1.172-2.777,1.935-3.59c0.762-0.817,1.946-1.225,3.564-1.225 c1.377,0,2.502,0.406,3.375,1.205c0.871,0.813,1.31,1.802,1.31,2.98c0,0.602-0.147,1.16-0.429,1.66 c-0.289,0.515-0.643,0.984-1.055,1.397c-0.419,0.425-1.103,1.047-2.039,1.866c-1.072,0.941-1.922,1.743-2.548,2.428 c-0.632,0.686-1.138,1.464-1.522,2.382c-0.378,0.9-0.57,1.959-0.57,3.199c0,0.975,0.259,1.721,0.783,2.217 c0.519,0.496,1.162,0.75,1.923,0.75c1.464,0,2.334-0.768,2.62-2.293c0.161-0.713,0.28-1.211,0.358-1.506 c0.084-0.281,0.192-0.562,0.342-0.857c0.149-0.281,0.375-0.602,0.675-0.945c0.294-0.345,0.698-0.736,1.194-1.203 c1.805-1.61,3.051-2.753,3.75-3.438c0.697-0.672,1.299-1.486,1.803-2.43C35.744,18.705,36,17.609,36,16.362 c0-1.574-0.441-3.05-1.333-4.388C33.777,10.621,32.521,9.55,30.896,8.772z"/>
                </g>
              </svg>
            </button>
          </div>
          </div>

          {/* Only show the recap card in place of the main card */}
          <div className="w-full rounded-lg overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-background)] shadow-sm">
            <SeasonRecapCard
              record={completedRecord}
              totalDonated={totalDonations ? totalDonations.totalDonated / 1000000 : 0}
              onNewSeason={() => setCompletedRecord(null)}
              onShare={handleShare}
            />
          </div>
        </div>
      </div>
    );
  }

  // Modal component (defined at module level to avoid hook issues)
  function Modal({ isOpen, message, type, onConfirm, onCancel, onClose, actionType, children }: {
    isOpen: boolean;
    message: string;
    type: 'alert' | 'confirm' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    onClose: () => void;
    actionType?: string;
    children?: React.ReactNode;
  }) {
    if (!isOpen) return null;
    
    // Handle clicks outside the modal content
    const handleBackdropClick = (e: React.MouseEvent) => {
      // If clicking the backdrop (not the modal content)
      if (e.target === e.currentTarget) {
        // For confirmation modals, treat as cancel
        if (type === 'confirm') {
          onCancel();
        } else {
          // For alert modals, just close
          onClose();
        }
      }
    };
    
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center" 
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={handleBackdropClick}
      >
        <div className={`${type === 'info' ? 'bg-[var(--app-card-background)] max-w-md' : 'bg-white max-w-sm'} rounded-lg p-6 mx-auto border border-[var(--app-border)] shadow-sm`}>
          <div className="mb-6">
            {type === 'info' ? (
              <>
                <h3 className="text-xl font-semibold text-[var(--app-accent,#3B8A73)] mb-4 text-center">{message}</h3>
                {children}
              </>
            ) : (
              <p className="text-gray-800 text-center">{message}</p>
            )}
          </div>
          <div className="flex justify-center space-x-4">
            {type === 'confirm' && (
              <button 
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <button 
              className={`px-4 py-2 rounded-md ${
                type === 'confirm' && actionType === 'cancel-season' 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white'
              }`}
              onClick={type === 'confirm' ? onConfirm : onClose}
            >
              {type === 'confirm' 
                ? (actionType === 'cancel-season' ? 'End Season' : 'Confirm')
                : 'OK'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen font-sans text-[var(--app-foreground)]" style={{
      ...themeStyles,
      backgroundColor: "#F7F6E7",
      background: "#F7F6E7",
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch' // For smooth scrolling on iOS
    }}>
      <div className="w-full max-w-md mx-auto px-4 py-3" style={{ backgroundColor: "#F7F6E7" }}>
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <div className="flex items-center space-x-2">
              <WalletConnect />
            </div>
          </div>
          <div>{saveFrameButton}</div>
        </header>
        
        <div className="text-center mt-3 mb-4">
        <h1 className="text-6xl" style={{ fontFamily: 'var(--font-custom)', letterSpacing: '0.2em', color: '#5FA578' }}>EON</h1>
          <p className="text-lg text-[var(--app-foreground-muted)]">compound your impact for the longterm</p>
          {/* Total donations counter */}
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="text-sm font-medium text-[var(--app-accent)]">
              {totalDonations ? (
                <span>${(totalDonations.totalDonated / 1000000).toFixed(2)} donated</span>
              ) : (
                <span>$0.00 donated</span>
              )}
            </div>
            <div className="w-px h-5 bg-[var(--app-accent)] opacity-30"></div>
            <div className="text-sm font-medium text-[var(--app-accent)]">
              {transactionRecordCount ? (
                <span>{transactionRecordCount} donations</span>
              ) : (
                <span>No donations</span>
              )}
            </div>
          </div>
          
          
          <div className="flex mb-6 justify-center">
            <button 
              onClick={() => {
                setModalType('info');
                setModalMessage('About EON');
                setModalOpen(true);
              }}
              className="text-[var(--app-foreground-muted)] text-xs cursor-pointer font-medium flex items-center"
            >
              How it works
              <svg className="ml-1" fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="10" height="10">
                <circle cx="20" cy="20" r="19" stroke="#000" stroke-width="2" fill="none" />
                <g transform="scale(0.8) translate(2.5,2.5)">
                  <path d="M24.733,34.318c-0.936,0-1.73,0.322-2.375,0.947c-0.645,0.627-0.968,1.414-0.968,2.338c0,1.035,0.334,1.85,1,2.429 c0.667,0.581,1.449,0.862,2.342,0.862c0.868,0,1.631-0.297,2.295-0.881c0.656-0.582,0.988-1.395,0.988-2.41 c0-0.924-0.32-1.711-0.953-2.338C26.439,34.641,25.657,34.318,24.733,34.318z"/>
                  <path d="M30.896,8.772c-1.631-0.791-3.51-1.18-5.629-1.18c-2.295,0-4.294,0.473-6.005,1.401c-1.718,0.943-3.026,2.126-3.919,3.562 C14.45,13.978,14,15.394,14,16.787c0,0.67,0.281,1.295,0.848,1.889c0.561,0.565,1.258,0.861,2.076,0.861 c1.395,0,2.342-0.832,2.844-2.488c0.527-1.574,1.172-2.777,1.935-3.59c0.762-0.817,1.946-1.225,3.564-1.225 c1.377,0,2.502,0.406,3.375,1.205c0.871,0.813,1.31,1.802,1.31,2.98c0,0.602-0.147,1.16-0.429,1.66 c-0.289,0.515-0.643,0.984-1.055,1.397c-0.419,0.425-1.103,1.047-2.039,1.866c-1.072,0.941-1.922,1.743-2.548,2.428 c-0.632,0.686-1.138,1.464-1.522,2.382c-0.378,0.9-0.57,1.959-0.57,3.199c0,0.975,0.259,1.721,0.783,2.217 c0.519,0.496,1.162,0.75,1.923,0.75c1.464,0,2.334-0.768,2.62-2.293c0.161-0.713,0.28-1.211,0.358-1.506 c0.084-0.281,0.192-0.562,0.342-0.857c0.149-0.281,0.375-0.602,0.675-0.945c0.294-0.345,0.698-0.736,1.194-1.203 c1.805-1.61,3.051-2.753,3.75-3.438c0.697-0.672,1.299-1.486,1.803-2.43C35.744,18.705,36,17.609,36,16.362 c0-1.574-0.441-3.05-1.333-4.388C33.777,10.621,32.521,9.55,30.896,8.772z"/>
                </g>
              </svg>
            </button>
          </div>

          {/* Tabs for Seasons/Campaigns */}
          <div className="flex justify-center mb-4">
            <button
              className={`px-4 py-2 rounded-t-lg font-medium border-b-2 transition-colors duration-200 ${selectedTab === 'seasons' ? 'border-[var(--app-accent)] text-[var(--app-accent)] bg-[var(--app-card-background)]' : 'border-transparent text-[var(--app-foreground-muted)] bg-transparent hover:text-[var(--app-accent)]'}`}
              onClick={() => setSelectedTab('seasons')}
              aria-selected={selectedTab === 'seasons'}
            >
              Seasons
            </button>
            <button
              className={`px-4 py-2 rounded-t-lg font-medium border-b-2 transition-colors duration-200 ml-2 ${selectedTab === 'campaigns' ? 'border-[var(--app-accent)] text-[var(--app-accent)] bg-[var(--app-card-background)]' : 'border-transparent text-[var(--app-foreground-muted)] bg-transparent hover:text-[var(--app-accent)]'}`}
              onClick={() => setSelectedTab('campaigns')}
              aria-selected={selectedTab === 'campaigns'}
            >
              Campaigns
            </button>
          </div>

        </div>
        
        {selectedTab === 'seasons' ? (
          <div className="w-full rounded-lg overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-background)] shadow-sm">
            <div className="bg-[var(--app-accent)] text-white px-4 py-3 font-medium flex justify-between items-center">
              {existingRecord ? 'Active season' : 'Start a new season'}
              {existingRecord && (
              <span className="text-xs bg-white text-[var(--app-accent)] px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          <div className="p-4">
            {existingRecord ? (
              <div className="mb-8">
                <p className="text-center text-sm text-[var(--app-foreground-muted)] mb-6 mx-6">
                  Your current donation commitment:
                </p>
                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-4 mb-4 mx-2 border border-gray-100">
                  <div className="text-sm text-gray-600">Percentage:</div>
                  <div className="text-lg font-medium">{existingRecord.percentAmount}%</div>
                </div>
                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-4 mb-4 mx-2 border border-gray-100">
                  <div className="text-sm text-gray-600">Goal amount:</div>
                  <div className="text-lg font-medium">${existingRecord.dollarAmount}</div>
                </div>
                
                {/* Progress bar section */}
                <div className="bg-gray-50 rounded-lg p-4 mx-2 border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-600">Progress:</div>
                    <div className="text-sm font-medium">
                      {isLoadingProgress ? (
                        <span className="inline-flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        donationProgress ? 
                          `$${Math.min(existingRecord.dollarAmount, (donationProgress.totalDonated / 1000000)).toFixed(2)} of $${existingRecord.dollarAmount}` :
                          '$0 of $' + existingRecord.dollarAmount
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-[var(--app-accent)] h-2.5 rounded-full" 
                         style={{ 
                           width: `${donationProgress ? 
                             Math.min(100, (donationProgress.totalDonated / 1000000) / existingRecord.dollarAmount * 100) : 
                             0}%` 
                         }}>
                    </div>
                  </div>
                  
                  {donationProgress && donationProgress.transactionCount > 0 && (
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      {donationProgress.transactionCount} donation{donationProgress.transactionCount !== 1 ? 's' : ''} processed
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-[var(--app-foreground-muted)] mb-7 mx-6">
                donate a percentage of what you earn on farcaster up to your desired goal amount for the sprint
              </p>
            )}
            {!existingRecord && (
              <>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={decreasePercentage}
                    className="w-10 h-10 rounded-full bg-[var(--app-gray)] flex items-center justify-center hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]"
                  >
                    <span className="text-xl font-bold">-</span>
                  </button>
                  <div className="text-2xl font-bold min-w-[80px] text-center">
                    {percentage}%
                  </div>
                  <button 
                    onClick={increasePercentage}
                    className="w-10 h-10 rounded-full bg-[var(--app-gray)] flex items-center justify-center hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]"
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>
                </div>
                <div className="text-center text-xs text-[var(--app-foreground-muted)] mt-1">
                  percent
                </div>
                
                <div className="h-4"></div>
                
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={decreaseAmount}
                    className="w-10 h-10 rounded-full bg-[var(--app-gray)] flex items-center justify-center hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]"
                  >
                    <span className="text-xl font-bold">-</span>
                  </button>
                  <div className="text-2xl font-bold min-w-[80px] text-center">
                    ${amount}
                  </div>
                  <button 
                    onClick={increaseAmount}
                    className={`w-10 h-10 rounded-full flex items-center justify-center bg-[var(--app-gray)] ${wouldExceedBalance ? disabledButtonClass : 'hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]'}`}
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>
                </div>
                <div className="relative">
                  <div className="text-center text-xs text-[var(--app-foreground-muted)] mt-1">
                    goal amount
                  </div>
                  {/* Error message that fades after 1 second (positioned absolutely) */}
                  <div 
                    className={`absolute w-full text-center text-red-500 text-xs mt-1 transition-opacity duration-700 ${showSeasonsUsdcError ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{height: '0px'}}
                  >
                    Not enough USDC on Base
                  </div>
                </div>
              </>
            )}
            
            <div className="mt-12 flex justify-center gap-4">
              {isLoadingRecord ? (
                <div className="bg-gray-200 text-gray-600 px-8 py-2 rounded-md font-medium inline-flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </div>
              ) : existingRecord ? (
                <button 
                  className="bg-transparent text-red-500 border border-red-500 px-6 py-2 rounded-md font-medium hover:bg-red-50 active:bg-red-100 transition-colors"
                  onClick={async () => {
                    if (existingRecord && address) {
                      try {
                        // Show confirmation dialog for cancelling season
                        setModalMessage('Are you sure you want to end your active season?');
                        setModalType('confirm');
                        setActionType('cancel-season');
                        setActionData({
                          recordId: existingRecord._id,
                          walletAddress: address
                        });
                        setModalOpen(true);
                        return;
                        
                        // The actual cancellation logic is now in the modal callback
                      } catch (error) {
                        console.error('Error setting up cancel modal:', error);
                        // Fallback in case modal setup fails
                      }
                    }
                  }}
                  disabled={isSending || isConfirming || isApproving}
                >
                  {isApproving ? "Cancelling..." : "End Season"}
                </button>
              ) : (
                <button 
                  className="bg-[var(--app-accent)] text-white px-8 py-2 rounded-md font-medium hover:bg-[var(--app-accent-hover)] active:bg-[var(--app-accent-active)] transition-colors"
                  onClick={handleApprove}
                  disabled={isApproving || !isConnected || isSwitchingChain}
                >
                  {isSending || isConfirming ? "Confirming..." : "Commit"}
                </button>
              )}
            </div>
            
            {error && (
              <div className="mt-4 text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            {/* Show season recap card if most recent season is inactive and completed */}
            {completedRecord ? (
  <>
    {console.log('Rendering SeasonRecapCard with:', completedRecord)}
    <SeasonRecapCard
      record={completedRecord}
      totalDonated={totalDonations ? totalDonations.totalDonated / 1000000 : 0}
      onNewSeason={() => setCompletedRecord(null)}
      onShare={handleShare}
    />
  </>
) : (
  // --- Active season UI (only shown if recap is NOT triggered) ---
  <>
    {/* All your existing active season UI goes here (the previous content of this block) */}
  </>
)}

            {txHash && showTxMessage && (
              <div className="mt-4 text-sm text-center transition-opacity duration-500 ease-in-out" 
                   style={{ opacity: showTxMessage ? 1 : 0 }}
              >
                <div>Transaction submitted!</div>
                <a 
                  href={`${ETHERSCAN_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--app-accent)] hover:underline"
                >
                  View on Etherscan
                </a>
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="w-full rounded-lg overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-background)] shadow-sm flex flex-col min-h-[calc(100vh-300px)]">
            <div className="bg-[var(--app-accent)] text-white px-4 py-3 font-medium">
              Start a New Campaign
            </div>
            <div className="p-4 flex flex-col flex-grow">
              {!showCampaignSearch ? (
                <>
                  <p className="text-center text-sm text-[var(--app-foreground-muted)] mb-7 mx-6">
                    To kick off a campaign donate to a good cause, cast about it, and we'll pass along the tips as donations
                  </p>
                  <div className="flex justify-center">
                    <button 
                      className="bg-[var(--app-accent)] hover:brightness-90 text-white font-medium py-2 px-6 rounded-md transition-all duration-200"
                      onClick={() => setShowCampaignSearch(true)}
                    >
                      Start Campaign
                    </button>
                  </div>
                </>
              ) : selectedOrganization ? (
                <div className="w-full max-w-md mx-auto flex flex-col flex-grow">
                  {/* Back button - goes back to search or profile depending on current step */}
                  <div className="self-start">
                    <button 
                      className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--app-foreground-muted)] hover:text-[var(--app-accent)] transition-colors"
                      onClick={() => campaignStep === 'profile' ? setSelectedOrganization(null) : setCampaignStep('profile')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="black" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Logo and name header - shown on both profile and finalize screens */}
                  <div className="flex items-center mb-4 justify-center">
                    {/* Logo */}
                    <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-xl overflow-hidden mr-4">
                      {selectedOrganization.logo ? (
                        <img 
                          src={selectedOrganization.logo} 
                          alt={`${selectedOrganization.name} logo`} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNFREVERUQiLz48cGF0aCBkPSJNMjAgMTNDMTUuNDEgMTMgMTIgMTYuNDEgMTIgMjFDMTIgMjUuNTkgMTUuNDEgMjkgMjAgMjlDMjQuNTkgMjkgMjggMjUuNTkgMjggMjFDMjggMTYuNDEgMjQuNTkgMTMgMjAgMTNaTTIwIDE2QzIxLjY1NyAxNiAyMyAxNy4zNDMgMjMgMTlDMjMgMjAuNjU3IDIxLjY1NyAyMiAyMCAyMkMxOC4zNDMgMjIgMTcgMjAuNjU3IDE3IDE5QzE3IDE3LjM0MyAxOC4zNDMgMTYgMjAgMTZaTTIwIDI3QzE3LjUgMjcgMTUuMjcgMjUuODkgMTQgMjRDMTQuMDIgMjIuMzcgMTcuMzUgMjEuNTQgMjAgMjEuNTRDMjIuNjQgMjEuNTQgMjUuOTggMjIuMzcgMjYgMjRDMjQuNzMgMjUuODkgMjIuNSAyNyAyMCAyN1oiIGZpbGw9IiM5Mjk0OTciLz48L3N2Zz4=';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--app-background)] text-[var(--app-foreground-muted)]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="M15 13h-3.5a2 2 0 0 0-2 2v4"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Name */}
                    <h2 className="text-xl font-semibold">{selectedOrganization.name}</h2>
                  </div>

                  {/* Conditional content based on step */}
                  {campaignStep === 'profile' ? (
                    /* Profile content */
                    <div className="flex flex-col items-center">
                      {/* Description with show more functionality */}
                      {selectedOrganization.description && (
                        <div className="w-full text-left mt-2">
                          <div className="relative">
                            <p 
                              className={`text-sm text-[var(--app-foreground-muted)] ${!showFullDescription ? 'line-clamp-3' : ''}`}
                            >
                              {selectedOrganization.description}
                            </p>
                            {!showFullDescription && (
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--app-card-background)] to-transparent"></div>
                            )}
                          </div>
                          <div className="flex justify-center w-full">
                            <button 
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-xs text-[var(--app-accent)] hover:underline mt-1"
                            >
                              {showFullDescription ? 'Show less' : 'Show more...'}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Select button */}
                      <div className="mt-8 w-full flex justify-center">
                        <button 
                          className="bg-[var(--app-accent)] hover:brightness-90 text-white font-medium py-2 px-8 rounded-md transition-all duration-200"
                          onClick={() => setCampaignStep('finalize')}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Finalize campaign screen */
                    <div className="flex flex-col items-start w-full">
                      <div className="w-full py-4">
                        {/* Donation Amount */}
                        <div className="mb-10">
                          <label className="block text-[var(--app-foreground)] text-lg font-medium mb-5">Your donation:</label>
                          <div className="relative">
                            <div className="flex items-center justify-center gap-4">
                              <button 
                                onClick={() => setCampaignDonation(prev => prev > 1 ? prev - 1 : 1)}
                                className="w-10 h-10 rounded-full bg-[var(--app-gray)] flex items-center justify-center hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]"
                              >
                                <span className="text-xl font-bold">-</span>
                              </button>
                              <div className="text-2xl font-bold min-w-[80px] text-center">
                                ${campaignDonation}
                              </div>
                              <button 
                                onClick={() => {
                                  // If would exceed balance, show error message
                                  if (wouldCampaignDonationExceedBalance) {
                                    showUsdcErrorMessage();
                                    return;
                                  }
                                  
                                  const newDonation = campaignDonation + 1;
                                  setCampaignDonation(newDonation);
                                  
                                  // Ensure campaign goal is never less than donation amount
                                  if (newDonation > campaignGoal) {
                                    setCampaignGoal(newDonation);
                                  }
                                }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center bg-[var(--app-gray)] ${wouldCampaignDonationExceedBalance ? disabledButtonClass : 'hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]'}`}
                              >
                                <span className="text-xl font-bold">+</span>
                              </button>
                            </div>
                            {/* Error message that fades after 1.5 seconds (positioned absolutely so it doesn't affect layout) */}
                            <div 
                              className={`absolute w-full text-center text-red-500 text-xs mt-1 transition-opacity duration-700 ${showNotEnoughUsdcError ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                              style={{height: '0px'}}
                            >
                              Not enough USDC on Base
                            </div>
                          </div>
                        </div>
                        
                        {/* Campaign Goal */}
                        <div className="mb-10">
                          <label className="block text-[var(--app-foreground)] text-lg font-medium mb-5">Campaign goal (your donation + tips):</label>
                          <div className="flex items-center justify-center gap-4">
                            <button 
                              onClick={() => setCampaignGoal(prev => Math.max(campaignDonation, prev > 1 ? prev - 1 : 1))}
                              className="w-10 h-10 rounded-full bg-[var(--app-gray)] flex items-center justify-center hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]"
                            >
                              <span className="text-xl font-bold">-</span>
                            </button>
                            <div className="text-2xl font-bold min-w-[80px] text-center">
                              ${campaignGoal}
                            </div>
                            <button 
                              onClick={() => {
                                // If would exceed balance, show error message
                                if (wouldCampaignGoalExceedBalance) {
                                  showGoalUsdcErrorMessage();
                                  return;
                                }
                                setCampaignGoal(prev => prev + 1);
                              }}
                              className={`w-10 h-10 rounded-full flex items-center justify-center bg-[var(--app-gray)] ${wouldCampaignGoalExceedBalance ? disabledButtonClass : 'hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]'}`}
                            >
                              <span className="text-xl font-bold">+</span>
                            </button>
                          </div>
                          <div className="relative">
                            <div className="text-center text-[10px] text-[var(--app-foreground-muted)] mt-1">
                              This USDC approval is only a passthrough. When your cast receives a tip, an equivalent donation will be made from this balance
                            </div>
                            {/* Error message that fades after 1 second (positioned absolutely) */}
                            <div 
                              className={`absolute w-full text-center text-red-500 text-xs mt-1 transition-opacity duration-700 ${showGoalUsdcError ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                              style={{height: '0px'}}
                            >
                              Not enough USDC on Base
                            </div>
                          </div>
                        </div>
                        
                        {/* Start Campaign Button */}
                        <div className="mt-8 w-full flex justify-center">
                          <button 
                            className="bg-[var(--app-accent)] hover:brightness-90 text-white font-medium py-3 px-8 rounded-md transition-all duration-200 w-full max-w-xs"
                          >
                            Start Campaign
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full max-w-md mx-auto flex flex-col flex-grow">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-[var(--app-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)] focus:border-transparent"
                      placeholder="Search for a cause..."
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                      autoFocus
                    />
                    <button 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-foreground-muted)] hover:text-[var(--app-accent)]"
                      onClick={() => setCampaignSearch('')}
                    >
                      {isSearching ? (
                        <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
                          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.79 5.13A5.5 5.5 0 0 0 8 5a5.5 5.5 0 0 0-5.5 5.5 5.5 5.5 0 0 0 11 0 5.5 5.5 0 0 0-3.21-5.37"/>
                        </svg>
                      ) : campaignSearch && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {/* Search Results */}
                  <div className="mt-4 flex-grow overflow-y-auto">
                    {searchResults.length > 0 ? (
                      <div className="space-y-3">
                        {searchResults.map((result, index) => (
                          <div 
                            key={index} 
                            className="p-3 border border-[var(--app-border)] rounded-lg bg-white hover:bg-[#f9f9f9] cursor-pointer transition-colors"
                            onClick={() => setSelectedOrganization(result)}
                          >
                            <div className="flex items-start gap-3">
                              {/* Logo */}
                              <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                                {result.logo ? (
                                  <img 
                                    src={result.logo} 
                                    alt={`${result.name} logo`} 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      // Fallback for failed image loads
                                      const target = e.target as HTMLImageElement;
                                      target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNFREVERUQiLz48cGF0aCBkPSJNMjAgMTNDMTUuNDEgMTMgMTIgMTYuNDEgMTIgMjFDMTIgMjUuNTkgMTUuNDEgMjkgMjAgMjlDMjQuNTkgMjkgMjggMjUuNTkgMjggMjFDMjggMTYuNDEgMjQuNTkgMTMgMjAgMTNaTTIwIDE2QzIxLjY1NyAxNiAyMyAxNy4zNDMgMjMgMTlDMjMgMjAuNjU3IDIxLjY1NyAyMiAyMCAyMkMxOC4zNDMgMjIgMTcgMjAuNjU3IDE3IDE5QzE3IDE3LjM0MyAxOC4zNDMgMTYgMjAgMTZaTTIwIDI3QzE3LjUgMjcgMTUuMjcgMjUuODkgMTQgMjRDMTQuMDIgMjIuMzcgMTcuMzUgMjEuNTQgMjAgMjEuNTRDMjIuNjQgMjEuNTQgMjUuOTggMjIuMzcgMjYgMjRDMjQuNzMgMjUuODkgMjIuNSAyNyAyMCAyN1oiIGZpbGw9IiM5Mjk0OTciLz48L3N2Zz4=';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-[var(--app-background)] text-[var(--app-foreground-muted)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                                      <circle cx="9" cy="9" r="2"></circle>
                                      <path d="M15 13h-3.5a2 2 0 0 0-2 2v4"></path>
                                    </svg>
                                  </div>
                                )}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-grow">
                                <div className="font-medium text-[var(--app-foreground)]">{result.name}</div>
                                {result.description && (
                                  <div className="text-xs text-[var(--app-foreground-muted)] mt-1 line-clamp-2">
                                    {result.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : campaignSearch && !isSearching ? (
                      <div className="text-center py-6 text-[var(--app-foreground-muted)]">
                        No organizations found
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Render the modal */}
      <Modal 
        isOpen={modalOpen}
        message={modalMessage}
        type={modalType}
        actionType={actionType}
        onConfirm={() => {
          // Handle the confirmation action based on action type
          if (actionType === 'cancel-season' && actionData) {
            // Set loading state
            setIsApproving(true);
            
            // Process the cancel season action
            fetch('/api/cancel-season', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recordId: actionData.recordId,
                walletAddress: actionData.walletAddress
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                // Just update state without showing success popup
                setExistingRecord(null);
                setAmount(5); // Reset to defaults
                setPercentage(10);
                // No success popup needed
              } else {
                // Show error message
                setModalMessage(`Failed to cancel: ${data.error || 'Unknown error'}`);
                setModalType('alert');
                setModalOpen(true);
              }
            })
            .catch(error => {
              console.error('Error cancelling season:', error);
              setModalMessage('An error occurred while cancelling your season.');
              setModalType('alert');
              setModalOpen(true);
            })
            .finally(() => {
              setIsApproving(false);
              setActionType('');
              setActionData(null);
            });
          }
          
          // Close the modal
          setModalOpen(false);
        }}
        onCancel={() => {
          // Clear action data and close modal
          setActionType('');
          setActionData(null);
          setModalOpen(false);
        }}
        onClose={() => {
          // Just close the modal for alerts
          setModalOpen(false);
        }}
      >
        {modalType === 'info' && (
          <div className="text-[var(--app-foreground)] text-sm space-y-4">
            <ol className="list-decimal pl-5 space-y-2">
              <p><strong className="text-[var(--app-accent,#3B8A73)]">What it does:</strong> Eon allows users to forward a small part of what they earn on farcaster to charity, with the belief that individuals will not even notice these micropayments, but together they add up to make a big difference.</p>
              <p><strong className="text-[var(--app-accent,#3B8A73)]">How it works:</strong> Users approve EON for a USDC allowance and decide what % of their farcaster revenue they want to be donated. EON then monitors the users connected wallet for incoming transactions and automatically forwards the donation percentage.</p>
              <p>Currently the default destination for funds is <a href="https://endaoment.org/" className="text-[var(--app-accent,#3B8A73)] underline">Endaoment</a>&apos;s <a href="https://app.endaoment.org/universal" className="text-[var(--app-accent,#3B8A73)] underline">Universal Impact Pool</a>, which serves as a matching pool for any direct donations made on Endaoment&apos;s platform. Being able to select a specific charity for your donations is coming soon!</p>
            </ol>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Main App component with Wagmi provider
export default function App() {
  return (
    <WagmiProviderComponent>
      <AppContent />
    </WagmiProviderComponent>
  );
}
