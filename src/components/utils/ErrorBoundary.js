import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: undefined };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('QA ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { style: { background: '#2b0f14', color: 'white', border: '1px solid #ef4444', borderRadius: 8, padding: 12 }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "QA crashed while rendering." }), _jsx("pre", { style: { whiteSpace: 'pre-wrap' }, children: String(this.state.error) }), _jsx("div", { style: { opacity: 0.8, fontSize: 12 }, children: "Check the browser console for stack trace." })] }));
        }
        return this.props.children;
    }
}
