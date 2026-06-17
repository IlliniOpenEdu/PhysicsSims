import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PhysicsSims error:', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
          <h1 className="text-2xl font-semibold text-red-400">Uh Oh! Something went against the laws of physics.</h1>
          <p className="mt-3 max-w-md text-center text-sm text-slate-400">
            An unexpected error occurred while loading the page. Please try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-md bg-sky-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Refresh page
          </button>
          {this.state.error && (
            <details className="mt-4 max-w-lg">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                Error details
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-slate-900 p-3 text-xs text-red-300">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
