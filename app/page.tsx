/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { useOpenUrl } from "@coinbase/onchainkit/minikit";
import { sdk } from "@farcaster/frame-sdk";
import { useEffect, useMemo, useState, useCallback } from "react";
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

// ERC20 ABI for the approve function
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

  // Effect to get the user's FID from the MiniKit context
  useEffect(() => {
    if (context) {
      console.log('Farcaster context loaded:', context);
      
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

  // Custom theme colors
  const themeStyles = {
    "--app-accent": "#65B073",       // Slightly darker green
    "--app-accent-hover": "#55A063", // Adjusted hover state
    "--app-accent-active": "#478F53", // Adjusted active state
    "--app-card-background": "#FAFAF0",
  } as React.CSSProperties;

  const addFrame = useAddFrame();

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

  // Track which season we've already triggered a recap for
  const [recapTriggeredForSeasonId, setRecapTriggeredForSeasonId] = useState<string | null>(null);

  // Bulletproof recap trigger: checks all available data
  const checkAndTriggerRecap = useCallback(() => {
    // Use completedRecord if available and not already triggered
    if (
      completedRecord &&
      completedRecord._id &&
      recapTriggeredForSeasonId !== completedRecord._id &&
      (completedRecord.completed === true || completedRecord.active === false)
    ) {
      setRecapTriggeredForSeasonId(completedRecord._id);
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
        recapTriggeredForSeasonId !== existingRecord._id &&
        donatedDollars >= seasonGoal &&
        seasonGoal > 0
      ) {
        setCompletedRecord({ ...existingRecord, active: false, completed: true });
        setRecapTriggeredForSeasonId(existingRecord._id);
      }
    }
  }, [completedRecord, existingRecord, donationProgress, recapTriggeredForSeasonId]);

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
  }, [address, existingRecord, donationProgress, recapTriggeredForSeasonId]);

  // Effect to fetch existing active records when wallet connects
  useEffect(() => {
    if (isConnected && address) {
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

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const increaseAmount = () => {
    setAmount(prev => prev + 1);
  };

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

  const fetchTransactionRecordCount = async () => {
    try {
      const response = await fetch('/api/transaction-records/count');
      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`Total transaction records: ${data.count}`);
        setTransactionRecordCount(data.count);
      } else {
        console.error('Error fetching transaction record count:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch transaction record count:', error);
    }
  };

  useEffect(() => {
    fetchTransactionRecordCount();
  }, []);

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
            <h1 className="text-6xl mb-3 mt-2 text-[var(--app-accent)]" style={{ fontFamily: 'var(--font-custom)', letterSpacing: '0.2em' }}>EON</h1>
            <div className="text-lg font-medium text-[var(--app-accent)] mb-0">
              {totalDonations ? (
                <span>
                  ${(totalDonations.totalDonated / 1000000).toFixed(2)} donated
                </span>
              ) : (
                <span>$0.00 donated</span>
              )}
            </div>
            <div className="text-sm font-medium text-[var(--app-accent)] mb-4">
              {transactionRecordCount ? (
                <span>{transactionRecordCount} donations</span>
              ) : (
                <span>No donations</span>
              )}
            </div>
            <p className="text-lg mt-2 text-[var(--app-foreground-muted)]">compound your impact for the longterm</p>
          </div>

          {/* Only show the recap card in place of the main card */}
          <div className="w-full rounded-lg overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-background)] shadow-sm">
            <SeasonRecapCard
  record={completedRecord}
  totalDonated={totalDonations ? totalDonations.totalDonated / 1000000 : 0}
  onNewSeason={() => setShowRecap(false)}
  onShare={handleShare}
/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)]" style={{
      ...themeStyles,
      backgroundColor: "#F7F6E7",
      background: "#F7F6E7",
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
        
        <div className="text-center my-8">
          <h1 className="text-6xl mb-3 mt-2 text-[var(--app-accent)]" style={{ fontFamily: 'var(--font-custom)', letterSpacing: '0.2em' }}>EON</h1>
          
          {/* Total donations counter */}
          <div className="text-lg font-medium text-[var(--app-accent)] mb-0">
            {totalDonations ? (
              <span>
                ${(totalDonations.totalDonated / 1000000).toFixed(2)} donated
              </span>
            ) : (
              <span>$0.00 donated</span>
            )}
          </div>
          
          {/* Transaction record count */}
          <div className="text-sm font-medium text-[var(--app-accent)] mb-4">
            {transactionRecordCount ? (
              <span>{transactionRecordCount} donations</span>
            ) : (
              <span>No donations</span>
            )}
          </div>
          
          <p className="text-lg mt-2 text-[var(--app-foreground-muted)]">compound your impact for the longterm</p>
        </div>
        
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
                          `$${(donationProgress.totalDonated / 1000000).toFixed(2)} of $${existingRecord.dollarAmount}` :
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
                
                <p className="text-center text-xs text-gray-500 mt-5 mx-6">
                  Started on {new Date(existingRecord.timestamp).toLocaleDateString()}
                </p>
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
                    className="w-10 h-10 rounded-full bg-[var(--app-gray)] flex items-center justify-center hover:bg-[var(--app-gray-hover)] active:bg-[var(--app-gray-active)]"
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>
                </div>
                <div className="text-center text-xs text-[var(--app-foreground-muted)] mt-1">
                  goal amount
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
                        const confirmed = window.confirm('Are you sure you want to cancel your active season?');
                        if (!confirmed) return;
                        
                        setIsApproving(true); // Reuse this state for the cancellation process
                        
                        const response = await fetch('/api/cancel-season', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            recordId: existingRecord._id,
                            walletAddress: address
                          })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.success) {
                          setExistingRecord(null);
                          setAmount(5); // Reset to defaults
                          setPercentage(10);
                          alert('Your season has been cancelled.');
                        } else {
                          alert(`Failed to cancel: ${data.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Error cancelling season:', error);
                        alert('An error occurred while cancelling your season.');
                      } finally {
                        setIsApproving(false);
                      }
                    }
                  }}
                  disabled={isSending || isConfirming || isApproving}
                >
                  {isApproving ? "Cancelling..." : "Cancel Season"}
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
            {(completedRecord && recapTriggeredForSeasonId === completedRecord._id) && (
              <>
                {console.log('Rendering SeasonRecapCard with:', completedRecord)}
                <SeasonRecapCard
  record={completedRecord}
  totalDonated={totalDonations ? totalDonations.totalDonated / 1000000 : 0}
  onNewSeason={() => setShowRecap(false)}
  onShare={handleShare}
/>
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
      </div>
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
