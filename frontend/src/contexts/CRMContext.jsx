import React, { createContext, useContext, useState, useEffect } from 'react';

export const CRM_CONFIG = {
  investimento: { label: 'Investimento', color: '#355641', icon: '📈', bgLight: '#f0f4f1' },
  cambio: { label: 'Câmbio', color: '#2563eb', icon: '💱', bgLight: '#eff6ff' },
  credito: { label: 'Crédito', color: '#7c3aed', icon: '💳', bgLight: '#f5f3ff' },
  seguro: { label: 'Seguro', color: '#0891b2', icon: '🛡️', bgLight: '#ecfeff' },
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
