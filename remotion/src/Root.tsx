import React from 'react';
import { Composition } from 'remotion';
import { AdComposition, AdProps } from './AdComposition';

export function RemotionRoot() {
  const defaultProps: AdProps = {
    clips: [],
    voSegments: [],
    bgMusicTheme: undefined,
    bgMusicVolume: 0.4,
    textOverlays: [],
    endCard: {
      priceDisplay: '€45',
      ratingDisplay: '4.8★',
      reviewCountDisplay: '12,450+ reviews',
      ctaText: 'Book Now',
      brandLogo: true,
      cancellationText: 'Free cancellation',
    },
    fps: 30,
  };

  return (
    <Composition
      id="AdComposition"
      component={AdComposition}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
}
