import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

// Headout brand purple — matches the blimp logo
const HEADOUT_PURPLE = '#7700FF';

export interface EndCardProps {
  priceDisplay: string;
  ratingDisplay: string;
  reviewCountDisplay: string;
  ctaText: string;
  brandLogo: boolean;
  cancellationText: string | null;
  experienceImageSrc?: string;
  experienceName?: string;
}

export const EndCard: React.FC<EndCardProps> = ({
  priceDisplay,
  ratingDisplay,
  reviewCountDisplay,
  ctaText,
  brandLogo,
  cancellationText,
  experienceImageSrc,
  experienceName,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const cardSlide = interpolate(frame, [0, 16], [40, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: 'linear-gradient(180deg, #c4e8f4 0%, #8ecfe3 55%, #62bdd6 100%)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Headout logo lockup — blimp icon + wordmark */}
      {brandLogo && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            zIndex: 10,
          }}
        >
          <Img
            src={staticFile('headout-logo.png')}
            style={{ height: 56, width: 'auto' }}
          />
          <span
            style={{
              color: HEADOUT_PURPLE,
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: -1.5,
              lineHeight: 1,
            }}
          >
            headout
          </span>
        </div>
      )}

      {/* Experience photo card — overlaps slightly behind the bottom panel */}
      <div
        style={{
          position: 'absolute',
          top: brandLogo ? 164 : 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 880,
          height: 980,
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 28px 80px rgba(0, 60, 90, 0.22)',
          border: '4px solid rgba(255, 255, 255, 0.75)',
          background: 'linear-gradient(135deg, #a4d4e8 0%, #6ab8d0 100%)',
          zIndex: 1,
        }}
      >
        {experienceImageSrc && (
          <Img
            src={experienceImageSrc}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Bottom booking panel */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 780,
          background: 'white',
          borderRadius: '48px 48px 0 0',
          boxShadow: '0 -12px 60px rgba(0, 40, 80, 0.14)',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          padding: '52px 56px 64px',
          transform: `translateY(${cardSlide}px)`,
        }}
      >
        {/* Price */}
        <div
          style={{
            color: '#0f172a',
            fontSize: 68,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          {priceDisplay}
        </div>

        {/* Experience name */}
        {experienceName && (
          <div
            style={{
              color: '#64748b',
              fontSize: 26,
              fontWeight: 500,
              marginTop: 10,
              lineHeight: 1.3,
            }}
          >
            {experienceName}
          </div>
        )}

        {/* Rating row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: experienceName ? 16 : 20,
          }}
        >
          <span style={{ color: '#F59E0B', fontSize: 30, fontWeight: 700 }}>
            {ratingDisplay}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 28, fontWeight: 400 }}>
            · {reviewCountDisplay}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* CTA button — Headout purple */}
        <div
          style={{
            background: HEADOUT_PURPLE,
            color: 'white',
            borderRadius: 20,
            height: 92,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: -0.5,
          }}
        >
          {ctaText}
        </div>

        {/* Free cancellation */}
        {cancellationText && (
          <div
            style={{
              color: '#64748b',
              fontSize: 22,
              fontWeight: 400,
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            ✓ {cancellationText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
