import React, { useState, useEffect } from 'react';
import useAPI from '../hooks/useAPI.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import TeamLocationMap from '../components/TeamLocationMap.jsx';

export default function EquipeMapa() {
  const api = useAPI();
  const { isMaster } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMaster) { window.location.href = '/'; return; }
    (async () => {
      try {
        setUsers(await api.getUsers());
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isMaster]);

  const people = users.map(u => ({
    id: u._id,
    name: u.name,
    state: u.state,
    photo_url: u.photoUrl,
    subtitle: u.role === 'master' ? 'Master' : 'Consultor',
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1">Mapa da Equipe</h1>
        <p className="font-sans text-sm text-gray-500">
          Visão geográfica de onde cada integrante da equipe está localizado
        </p>
      </div>

      <TeamLocationMap
        people={people}
        loading={loading}
        legendLabel="Consultor localizado"
        avatarColor="#355641"
      />
    </div>
  );
}
