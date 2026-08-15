import React from 'react';

export const StatCard = ({ icon: Icon, color = 'blue', label, value, subtext, trend }) => {
  return (
    <div className="stat-card kpi-card">
      <div className={`stat-icon-wrapper stat-icon-${color} kpi-icon-wrap ${color}`}>
        {Icon && <Icon size={24} strokeWidth={2.2} />}
      </div>
      <div className="stat-content kpi-details">
        <div className="stat-label kpi-label">{label}</div>
        <div className="stat-value kpi-value">{value}</div>
        {subtext && <div className="stat-subtext kpi-subtext">{subtext}</div>}
      </div>
    </div>
  );
};

