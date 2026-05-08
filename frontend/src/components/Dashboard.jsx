import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { checkBackendStatus } from '../lib/api';
import AlertsTable from './AlertsTable';
import MapView from './MapView';

const Dashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [newAlertId, setNewAlertId] = useState(null);

  // Poll backend status
  useEffect(() => {
    const pingBackend = async () => {
      const status = await checkBackendStatus();
      setIsOnline(status);
    };

    // Initial ping
    pingBackend();

    // Ping every 3 seconds
    const interval = setInterval(pingBackend, 3000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error) {
           setAlerts(data || []);
        }
      } catch (err) {
        console.error("Error fetching alerts:", err.message);
      }
    };

    fetchAlerts();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
        },
        (payload) => {
          const newAlert = payload.new;
          setAlerts((prev) => {
            const updated = [newAlert, ...prev].slice(0, 20); // Keep last 20
            return updated;
          });
          
          // Trigger glow animation for bonus point
          setNewAlertId(newAlert.id);
          setTimeout(() => setNewAlertId(null), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="glass-panel dashboard-header">
        <div className="title-container">
          <h1>SOS SYSTEM</h1>
        </div>
        <div className={`status-indicator ${isOnline ? 'status-online' : 'status-offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
        </div>
      </header>

      {/* Live Alerts */}
      <AlertsTable 
        alerts={alerts} 
        selectedLocation={selectedLocation} 
        onSelectLocation={setSelectedLocation}
        newAlertId={newAlertId}
      />

      {/* Map View */}
      <MapView location={selectedLocation} />
    </div>
  );
};

export default Dashboard;
