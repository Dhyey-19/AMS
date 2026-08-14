import React from 'react';

export const StatusBadge = ({ status }) => {
  const isWorking = status === 'Working';
  const isResigned = status === 'Resigned';

  if (isWorking) {
    return (
      <span className="badge badge-working">
        <span className="badge-dot"></span>
        Working
      </span>
    );
  }

  if (isResigned) {
    return (
      <span className="badge badge-resigned">
        <span className="badge-dot"></span>
        Resigned
      </span>
    );
  }

  return (
    <span className="badge badge-dept">
      {status || 'Unknown'}
    </span>
  );
};

export const AttendanceStatusBadge = ({ status }) => {
  const code = (status || '').toUpperCase();

  if (code === 'P') {
    return (
      <span className="badge badge-working">
        <span className="badge-dot" style={{ background: '#10b981' }}></span>
        Present
      </span>
    );
  }

  if (code === 'A') {
    return (
      <span className="badge badge-resigned">
        <span className="badge-dot" style={{ background: '#f43f5e' }}></span>
        Absent
      </span>
    );
  }

  if (code === 'WO') {
    return (
      <span className="badge badge-dept" style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
        <span className="badge-dot" style={{ background: '#64748b' }}></span>
        Weekly Off
      </span>
    );
  }

  if (code === 'WOP') {
    return (
      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
        <span className="badge-dot" style={{ background: '#d97706' }}></span>
        Off Present
      </span>
    );
  }

  if (code === 'HD') {
    return (
      <span className="badge" style={{ background: '#fdf4ff', color: '#86198f', borderColor: '#f5d0fe' }}>
        <span className="badge-dot" style={{ background: '#a21caf' }}></span>
        Half Day
      </span>
    );
  }

  return (
    <span className="badge badge-dept">
      {status || 'Unknown'}
    </span>
  );
};

export const DepartmentBadge = ({ department }) => {
  return (
    <span className="badge badge-dept">
      {department || 'General'}
    </span>
  );
};
