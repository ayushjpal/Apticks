import React from 'react'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  children: React.ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ArenaErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ArenaErrorBoundary] Caught render exception:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center pt-20 pb-16 px-4 arena-bg-grid">
          <div className="bg-[#091522] border-2 border-white/10 p-8 text-center max-w-md rounded-2xl shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white">
              {this.props.fallbackTitle || 'ARENA RUNTIME ERROR'}
            </h2>
            <p className="font-mono text-xs text-slate-300 leading-relaxed">
              {this.state.error?.message ||
                this.props.fallbackMessage ||
                'An unexpected rendering error occurred in the arena.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>RETRY</span>
              </button>
              <Link
                to="/1v1"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#ffd43b] hover:bg-[#facc15] text-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>RETURN TO 1v1 HUB</span>
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ArenaErrorBoundary
