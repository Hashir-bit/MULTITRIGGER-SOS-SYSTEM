import React from 'react';

const formatTime = (isoString) => {
  if (!isoString) return '--:--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getAlertType = (type) => {
  switch (type) {
    case 'fall_detected':
      return <span className="alert-tag tag-fall">🚨 FALL</span>;
    case 'manual_sos':
      return <span className="alert-tag tag-sos">🆘 SOS</span>;
    case 'location_update':
      return <span className="alert-tag tag-update">📍 UPDATE</span>;
    default:
      return <span className="alert-tag tag-update">🔔 {type || 'UNKNOWN'}</span>;
  }
};

const AlertsTable = ({ alerts, selectedLocation, onSelectLocation, newAlertId }) => {
  return (
    <div className="glass-panel table-container">
      <table className="alerts-table">
        <thead>
          <tr>
            <th>TIME</th>
            <th>TYPE</th>
            <th>DEVICE ID</th>
            <th>LOCATION</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 ? (
            <tr>
              <td colSpan="4" className="empty-state">WAITING FOR INCOMING TRANSMISSIONS...</td>
            </tr>
          ) : (
            alerts.map((alert) => (
              <tr 
                key={alert.id} 
                className={`
                  ${selectedLocation?.id === alert.id ? 'selected' : ''}
                  ${newAlertId === alert.id ? 'new-alert-row' : ''}
                `}
              >
                <td>{formatTime(alert.created_at)}</td>
                <td>{getAlertType(alert.trigger_type)}</td>
                <td><span className="device-id">{alert.device_id}</span></td>
                <td>
                  <button 
                    className={`map-btn ${selectedLocation?.id === alert.id ? 'active' : ''}`}
                    onClick={() => onSelectLocation({
                      id: alert.id,
                      lat: alert.latitude,
                      lon: alert.longitude,
                      deviceId: alert.device_id,
                      type: alert.trigger_type
                    })}
                  >
                    📍 View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AlertsTable;
