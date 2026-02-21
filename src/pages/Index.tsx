import SmartFocusTracker from '@/components/SmartFocusTracker';
import { Focus, Github } from 'lucide-react';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 glow-primary">
            <Focus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground font-mono tracking-tight">
              SmartFocus<span className="text-primary">.AI</span>
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Dynamic Subject Tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded bg-secondary border border-border">
            TF.js + COCO-SSD
          </span>
          <span className="px-2 py-1 rounded bg-secondary border border-border">
            Real-time
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6">
        <div className="h-[calc(100vh-120px)]">
          <SmartFocusTracker />
        </div>
      </main>
    </div>
  );
};

export default Index;
