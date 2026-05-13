'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-[#f4efeb] mb-1.5">
            Something went wrong
          </h3>
          <p className="text-sm text-[#aba8a4] mb-6 max-w-xs leading-relaxed">
            An unexpected error occurred. Your data is safe — try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#191c19] border border-[#2b2f2b] text-[#aba8a4] hover:text-[#f4efeb] hover:border-[#404540] transition-colors"
          >
            <RefreshCw size={14} />
            Refresh page
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 text-left max-w-lg">
              <summary className="text-xs text-[#aba8a4] cursor-pointer hover:text-[#f4efeb]">
                Error details (dev only)
              </summary>
              <pre className="mt-2 text-xs text-red-400 bg-[#111311] border border-[#2b2f2b] rounded-xl p-3 overflow-auto max-h-48">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
