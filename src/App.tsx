import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/TransactionsPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { NetWorthPage } from './pages/NetWorthPage';
import { RecurringTransactionsPage } from './pages/RecurringTransactionsPage';
import { SavingsPage } from './pages/SavingsPage';
import { BankAccountsPage } from './pages/BankAccountsPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <DataProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/investments" element={<InvestmentsPage />} />
            <Route path="/net-worth" element={<NetWorthPage />} />
            <Route path="/recurring" element={<RecurringTransactionsPage />} />
            <Route path="/savings" element={<SavingsPage />} />
            <Route path="/accounts" element={<BankAccountsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" richColors />
      </Router>
    </DataProvider>
  );
}
