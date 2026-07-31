import { BackgroundEffects } from './BackgroundEffects.jsx';
import { HeroSection } from './HeroSection.jsx';
import { AuthPanel } from './AuthPanel.jsx';
import { MouseParallaxProvider } from './MouseParallax.jsx';

export function AuthenticationLayout() {
  return (
    <MouseParallaxProvider>
      <main
        style={{
          position: 'relative', minHeight: '100vh', overflow: 'hidden',
          background: 'var(--auth-bg)',
        }}
      >
        <BackgroundEffects />
        <div
          style={{
            position: 'relative', zIndex: 10,
            display: 'grid', minHeight: '100vh',
            gridTemplateColumns: 'repeat(1, 1fr)',
          }}
          className="auth-layout-grid"
        >
          <HeroSection />
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderTop: '1px solid rgba(36,59,83,0.08)',
              background: 'rgba(255,255,255,0.25)', padding: '3.5rem 1.25rem',
              backdropFilter: 'blur(2px)',
            }}
            className="auth-panel-side"
          >
            <AuthPanel defaultRole={null} />
          </div>
        </div>
      </main>
    </MouseParallaxProvider>
  );
}
