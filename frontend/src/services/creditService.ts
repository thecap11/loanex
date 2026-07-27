import { supabase } from '@/src/lib/supabase';

export const creditService = {
  async getCreditProfile(userId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async ensureCustomer(userId: string, email: string, mobile: string) {
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return existing;

    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        email,
        mobile,
        cibil_score: 750,
        approved_limit: 50000,
        available_limit: 50000,
        kyc_status: 'PENDING',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCustomerProfile(userId: string, profile: any) {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...profile, updated_at: new Date().toISOString(), kyc_status: 'VERIFIED' })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCreditLimit(userId: string, approvedLimit: number, availableLimit: number) {
    const { data, error } = await supabase
      .from('customers')
      .update({ approved_limit: approvedLimit, available_limit: availableLimit, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async incrementCreditScoreOnPayment(userId: string) {
    const { data: customer } = await supabase
      .from('customers')
      .select('cibil_score')
      .eq('user_id', userId)
      .maybeSingle();
    if (!customer) return;
    const newScore = Math.min(900, customer.cibil_score + 1);
    await supabase
      .from('customers')
      .update({ cibil_score: newScore, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  },

  async updateCustomerEmiTerms(userId: string, terms: any) {
    const { data, error } = await supabase
      .from('customers')
      .update({
        custom_down_payment_pct: terms.custom_down_payment_pct,
        custom_interest_rate: terms.custom_interest_rate,
        custom_max_tenure: terms.custom_max_tenure,
        custom_processing_fee: terms.custom_processing_fee,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAllCustomers() {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
