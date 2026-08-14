import React from 'react';

export const StatCard = ({ icon: Icon, color = 'blue', label, value, subtext, trend }) => {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon-wrap ${color}`}>
        {Icon && <Icon size={26} strokeWidth={2.2} />}
      </div>
      <div className="kpi-details">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </div>
  );
};
