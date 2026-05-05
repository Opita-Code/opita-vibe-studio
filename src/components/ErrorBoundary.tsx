import { Component, type ReactNode, type ErrorInfo } from "react";

// ─── Props ──────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Nombre descriptivo del componente envuelto (para logging) */
  name?: string;
}

// ─── State ──────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary genérico para capturar errores de renderizado
 * en componentes hijos y mostrar un fallback elegante en lugar de
 * dejar la UI en blanco o romper toda la app.
 *
 * Uso:
 * ```tsx
 * <ErrorBoundary name="ChatPanel">
 *   <ChatPanel />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`,
      error.message,
      errorInfo.componentStack,
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-[#969696] gap-3 p-6">
          <span className="text-2xl">⚠️</span>
          <p className="text-sm text-center">Algo salió mal en este panel</p>
          <p className="text-xs text-[#616161] text-center max-w-md">
            {this.state.error?.message ?? "Error desconocido"}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1 text-xs bg-[#007acc] text-white rounded hover:bg-[#0098ff] transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
