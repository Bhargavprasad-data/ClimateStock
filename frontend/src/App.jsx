import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home, TrendingUp, Lightbulb, Sun, Moon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Prediction from './pages/Prediction';
import Insights from './pages/Insights';
import ChatBot from './components/ChatBot';


const Sidebar = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Prediction', path: '/predict', icon: <TrendingUp size={20} /> },
    { name: 'Insights', path: '/insights', icon: <Lightbulb size={20} /> },
  ];

  return (
    <div 
      className={`sidebar ${isExpanded ? 'expanded' : ''}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="sidebar-logo">
        <TrendingUp strokeWidth={2.5} color="var(--color-accent)" style={{ minWidth: '24px' }} />
        <span className="sidebar-text">ClimateStock</span>
      </div>
      <div className="nav-links">
        {navItems.map((item) => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={!isExpanded ? item.name : ''}
          >
            <div style={{ minWidth: '24px', display: 'flex', alignItems: 'center' }}>{item.icon}</div>
            <span className="sidebar-text">{item.name}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 16px', marginTop: 'auto' }}>
        <div className="nav-item" onClick={toggleTheme} title={!isExpanded ? 'Toggle Theme' : ''}>
           <div style={{ minWidth: '24px', display: 'flex', alignItems: 'center' }}>
             {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
           </div>
           <span className="sidebar-text">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <Router>
      <div className="app-container">
        <Sidebar theme={theme} toggleTheme={toggleTheme} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/predict" element={<Prediction />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        </main>
        <ChatBot />
      </div>
    </Router>
  );

}

export default App;
