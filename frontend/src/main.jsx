import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App.jsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;font-family:sans-serif;color:red"><h2>Erro de configuração</h2><p>VITE_CONVEX_URL não definida. Configure a variável de ambiente no Vercel.</p></div>';
  throw new Error('VITE_CONVEX_URL is not set');
}

const convex = new ConvexReactClient(convexUrl);

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#333' }}>
          <h2 style={{ color: 'red' }}>Erro ao inicializar o app</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
