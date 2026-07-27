import { supabase } from '@/src/lib/supabase';

export const adminService = {
  async getAdminStats() {
    const [productsRes, ordersRes, pendingOrdersRes, emiPendingRes, revenueRes] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).in('order_status', ['CONFIRMED', 'DISPATCHED', 'IN_TRANSIT']),
      supabase.from('approval_cases').select('*', { count: 'exact', head: true }).eq('current_status', 'PENDING'),
      supabase.from('orders').select('total_amount').eq('order_status', 'DELIVERED'),
    ]);

    const revenue = (revenueRes.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

    return {
      totalProducts: productsRes.count || 0,
      totalOrders: ordersRes.count || 0,
      pendingOrders: pendingOrdersRes.count || 0,
      emiPending: emiPendingRes.count || 0,
      totalRevenue: revenue,
    };
  },

  async isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  },
};
