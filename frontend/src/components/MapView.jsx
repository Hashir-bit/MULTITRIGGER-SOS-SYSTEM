import React from 'react';

const MapView = ({ location }) => {
  if (!location) {
    return (
      <div className="glass-panel map-container" style={{ alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <h2>📍 Select a location from table to view map</h2>
      </div>
    );
  }

  const { lat, lon, deviceId, type } = location;
  const mapUrl = `https://www.google.com/maps?q=${lat},${lon}&output=embed`;

  return (
    <div className="glass-panel map-container">
      <h2>📍 LIVE LOCATION: {deviceId || 'UNKNOWN'} {type ? `(${type})` : ''}</h2>
      <div className="map-frame-wrapper">
        <iframe
          title="Incident Location Map"
          className="map-iframe"
          src={mapUrl}
          allowFullScreen
          loading="lazy"
        ></iframe>
      </div>
    </div>
  );
};

export default MapView;
