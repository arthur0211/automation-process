import { Component } from 'preact';
import type { ComponentChildren } from 'preact';

interface Props {
  children: ComponentChildren;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div class="flex flex-col items-center justify-center h-screen p-6 text-center bg-red-50">
          <p class="text-sm font-medium text-red-700 mb-2">Something went wrong</p>
          <p class="text-xs text-red-500 mb-4">{this.state.error}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
