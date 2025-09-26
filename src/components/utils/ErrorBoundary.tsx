import * as React from 'react';

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('QA ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#2b0f14', color: 'white', border: '1px solid #ef4444', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>QA crashed while rendering.</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Check the browser console for stack trace.</div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
