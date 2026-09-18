import React from 'react';

export default function OrchidsBackground() {
  return (
    <div className="orchids-bg-container" aria-hidden="true">
      {/* Dynamic Luminous Aura Glows matching the reference image */}
      <div className="aura-glow aura-blue-top-right" />
      <div className="aura-glow aura-amber-middle-right" />
      <div className="aura-glow aura-purple-bottom-left" />
      <div className="aura-glow aura-cyan-top-left" />
      <div className="aura-mesh-overlay" />
    </div>
  );
}
