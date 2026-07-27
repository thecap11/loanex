import { supabase } from '@/src/lib/supabase';

export const transactionService = {
  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async recordTransaction(txn: any) {
    const { error } = await supabase.from('transactions').insert(txn);
    if (error) console.warn('[transactionService] record failed', error);
  },
};
