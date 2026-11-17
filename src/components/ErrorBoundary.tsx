import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = 'Something unexpected happened inside My World.';
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string };
      if (parsed?.error) {
        friendly = `Unable to complete ${parsed.operationType || 'data'} request: ${parsed.error}`;
      }
    } catch {
      if (raw) friendly = raw;
    }
    return { hasError: true, message: friendly };
  }

  override componentDidCatch(error: unknown): void {
    console.error('Application ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F1115] text-[#F1F3F6] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-[#171A21] border border-white/[0.08] p-7 space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F2B8A2]/15 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6 text-[#F2B8A2]" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-xl font-medium text-[#F1F3F6]">
                A Brief Pause
              </h1>
              <p className="text-sm text-[#98A2B3] leading-relaxed">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] px-5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Sanctuary
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
