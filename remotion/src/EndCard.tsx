import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface EndCardProps {
  priceDisplay: string;
  ratingDisplay: string;
  reviewCountDisplay: string;
  ctaText: string;
  brandLogo: boolean;
  cancellationText: string | null;
}

export const EndCard: React.FC<EndCardProps> = ({
  priceDisplay,
  ratingDisplay,
  reviewCountDisplay,
  ctaText,
  brandLogo,
  cancellationText,
}) => {
  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      padding: 40,
    }}>
      {brandLogo && (
        <div style={{
          color: '#ff5a5f',
          fontSize: 36,
          fontWeight: 800,
          fontFamily: 'Inter, system-ui, sans-serif',
          marginBottom: 24,
          letterSpacing: -1,
        }}>
          headout
        </div>
      )}

      <div style={{ color: 'white', fontSize: 64, fontWeight: 800, marginBottom: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {priceDisplay}
      </div>

      <div style={{ color: '#fbbf24', fontSize: 32, marginBottom: 32, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {ratingDisplay} · {reviewCountDisplay}
      </div>

      <div style={{
        background: '#ff5a5f',
        color: 'white',
        padding: '16px 48px',
        borderRadius: 12,
        fontSize: 28,
        fontWeight: 700,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {ctaText}
      </div>

      {cancellationText && (
        <div style={{ color: '#94a3b8', fontSize: 20, marginTop: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
          ✓ {cancellationText}
        </div>
      )}
    </AbsoluteFill>
  );
};
