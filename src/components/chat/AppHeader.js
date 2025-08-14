import React from 'react';
import './AppHeader.css';

const AppHeader = ({ user, onLogout }) => {
  return (
    <div className="app-header">
      <div className="app-title">
        <div className="app-name">YAOGAN</div>
        <div className="app-version">Chat</div>
      </div>
      
      {user && (
        <div className="user-controls">
          <button className="logout-button" onClick={onLogout}>退出</button>
        </div>
      )}
    </div>
  );
};

export default AppHeader;
