import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// Contains a crash to the page it happened on, so the navigation bar keeps working
// instead of the whole app going blank.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="card mx-auto max-w-lg">
        <div className="card-body flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" strokeWidth={2} />
          </span>
          <h1 className="text-lg font-semibold text-zinc-900">This page ran into a problem</h1>
          <p className="text-sm text-zinc-500">
            The rest of the app still works. Reload the page to try again, or go back to the dashboard.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn btn-outline" href="/dashboard">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
