import { BackgroundEffects } from "./BackgroundEffects";
import { HeroSection } from "./HeroSection";
import { AuthPanel } from "./AuthPanel";
import { MouseParallaxProvider } from "./MouseParallax";

export function AuthenticationLayout() {
  return (
    <MouseParallaxProvider>
      <main className="relative min-h-screen overflow-hidden bg-background">
        <BackgroundEffects />
        <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[60fr_40fr]">
          <HeroSection />
          <div className="flex items-center justify-center border-t border-border/60 bg-card/25 px-5 py-14 backdrop-blur-[2px] sm:px-10 lg:border-l lg:border-t-0">
            <AuthPanel />
          </div>
        </div>
      </main>
    </MouseParallaxProvider>
  );
}
