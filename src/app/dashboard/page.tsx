'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import DashboardView from '@/components/views/DashboardView';
import TransactionsView from '@/components/views/TransactionsView';
import BalanceView from '@/components/views/BalanceView';
import StkView from '@/components/views/StkView';
import B2cView from '@/components/views/B2cView';
import ReversalsView from '@/components/views/ReversalsView';
import AnalyticsView from '@/components/views/AnalyticsView';
import AuditView from '@/components/views/AuditView';
import SettingsView from '@/components/views/SettingsView';
import SettlementView from '@/components/views/SettlementView';
import NotificationsView from '@/components/views/NotificationsView';

export default function DashboardRootPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'transactions':
        return <TransactionsView />;
      case 'balance':
        return <BalanceView />;
      case 'stk':
        return <StkView />;
      case 'b2c':
        return <B2cView />;
      case 'reversals':
        return <ReversalsView />;
      case 'settlement':
        return <SettlementView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'audit':
        return <AuditView />;
      case 'settings':
        return <SettingsView />;
      case 'notifications':
        return <NotificationsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <Shell activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderView()}
    </Shell>
  );
}
