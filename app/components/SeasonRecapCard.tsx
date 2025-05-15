"use client";
import React from "react";

interface SeasonRecapCardProps {
  record: {
    dollarAmount: number;
    percentAmount: number;
    timestamp: string;
    // Add more fields as needed for recap
  };
  totalDonated: number; // in USDC (dollars)
  onNewSeason?: () => void;
  onShare?: () => void;
}

export function SeasonRecapCard({ record, totalDonated, onNewSeason, onShare }: SeasonRecapCardProps) {
  return (
    <div className="bg-[var(--app-card-background)] border border-[var(--app-card-border)] rounded-xl p-6 shadow animate-fade-in mt-6">
      <h2 className="text-xl font-bold mb-4 text-[var(--app-accent)]">Another season gone so fast!</h2>
      <div className="mb-2 text-[var(--app-foreground-muted)] text-base">
        Congratulations on another successful campaign!<br />
        You contributed <span className="font-semibold">${record.dollarAmount}</span> this season to help us collectively raise <span className="font-semibold">${totalDonated.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>.<br />
        Small things add up fast and together we can make a difference.<br />
        Take a moment to be proud of yourself!
      </div>
      <div className="flex justify-between mt-6">
        <button
          className="px-4 py-2 rounded-lg bg-[var(--app-accent)] text-white font-semibold hover:bg-[#2d3e7b] hover:shadow-md transition-colors"
          type="button"
          onClick={onNewSeason}
        >
          New Season
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-[var(--app-accent)] text-white font-semibold hover:bg-[#2d3e7b] hover:shadow-md transition-colors"
          type="button"
          onClick={onShare}
        >
          Share
        </button>
      </div>
    </div>
  );
}
