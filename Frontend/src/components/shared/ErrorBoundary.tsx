import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-bg flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-panel p-6 max-w-md w-full shadow-md text-center">
            <div className="w-12 h-12 rounded-full bg-overdue/10 text-overdue mx-auto flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-base font-semibold text-ink mb-1">
              Something went wrong
            </h1>
            <p className="text-xs text-ink-2 mb-4 leading-relaxed">
              An unexpected error occurred while displaying this page.
            </p>
            {this.state.error && (
              <div className="mb-4 p-2.5 bg-band/70 border border-line rounded-input text-left overflow-x-auto text-[11px] font-mono text-ink-2 max-h-28">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover active:bg-primary-hover text-white text-xs font-medium rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
