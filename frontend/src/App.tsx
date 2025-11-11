import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Products from './pages/Products';
import './App.css';

function App() {
  try {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<Products />} />
        </Routes>
      </BrowserRouter>
    );
  } catch (error) {
    console.error('Error in App component:', error);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h1>Application Error</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}

export default App;
