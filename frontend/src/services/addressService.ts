import { supabase } from '@/src/lib/supabase';

export const addressService = {
  async getAddresses(userId: string) {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addAddress(addr: any) {
    const { data, error } = await supabase.from('addresses').insert(addr).select().single();
    if (error) throw error;
    return data;
  },

  async updateAddress(id: string, updates: any) {
    const { data, error } = await supabase.from('addresses').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteAddress(id: string) {
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) throw error;
  },

  async setDefault(userId: string, id: string) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    const { data, error } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
