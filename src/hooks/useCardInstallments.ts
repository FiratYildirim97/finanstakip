import { useData } from '../context/DataContext';

export const useCardInstallments = () => {
  const { cardInstallments, loading, addCardInstallment, deleteCardInstallment, creditCards } = useData();

  const getInstallmentsByCard = (cardId: string) => {
    return cardInstallments.filter(ci => ci.card_id === cardId);
  };

  const getCardName = (cardId: string) => {
    return creditCards.find(c => c.id === cardId)?.name || 'Bilinmeyen Kart';
  };

  const getMonthlyAmount = (ci: { total_amount: number; installment_count: number }) => {
    return ci.total_amount / ci.installment_count;
  };

  const getProgress = (ci: { start_date: string; installment_count: number }) => {
    const start = new Date(ci.start_date);
    const now = new Date();
    const monthsPassed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
    const paid = Math.min(monthsPassed, ci.installment_count);
    const remaining = ci.installment_count - paid;
    return { paid, remaining, percent: (paid / ci.installment_count) * 100, isCompleted: remaining <= 0 };
  };

  return {
    installments: cardInstallments,
    loading,
    addCardInstallment,
    deleteCardInstallment,
    getInstallmentsByCard,
    getCardName,
    getMonthlyAmount,
    getProgress,
  };
};
