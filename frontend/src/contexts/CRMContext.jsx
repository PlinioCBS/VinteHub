import React, { createContext, useContext, useState, useEffect } from 'react';

export const CRM_CONFIG = {
  investimento: { label: 'Investimento', color: '#5aaa6e', icon: '📈', bgLight: 'rgba(53,86,65,0.08)' },
  credito: { label: 'Crédito', color: '#7c3aed', icon: '💳', bgLight: 'rgba(124,58,237,0.08)' },
  cambio: { label: 'Câmbio', color: '#2563eb', icon: '💱', bgLight: 'rgba(37,99,235,0.08)' },
  seguro: { label: 'Seguro', color: '#0891b2', icon: '🛡️', bgLight: 'rgba(8,145,178,0.08)' },
};

const CRMContext = createContext(null);

export function CRMProvider({ children }) {
  const [activeCRM, setActiveCRMState] = useState(() => {
    return localStorage.getItem('vinte_crm') || 'investimento';
  });

  const setActiveCRM = (crm) => {
    localStorage.setItem('vinte_crm', crm);
    setActiveCRMState(crm);
  };

  const crmConfig = CRM_CONFIG;
  const currentCRM = CRM_CONFIG[activeCRM] || CRM_CONFIG.investimento;

  return (
    <CRMContext.Provider value={{ activeCRM, setActiveCRM, crmConfig, currentCRM }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  return useContext(CRMContext);
}
