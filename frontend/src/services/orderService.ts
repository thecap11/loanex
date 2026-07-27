import { supabase } from '@/src/lib/supabase';
import { generateOrderId, generateTrackingId } from '@/src/lib/emi';
import { transactionService } from './transactionService';

export const orderService = {
  async getOrders(userId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAllOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getOrder(id: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createOrder(order: any) {
    const orderId = generateOrderId();
    const trackingId = generateTrackingId();
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 4);

    const { data, error } = await supabase
      .from('orders')
      .insert({
        ...order,
        order_id: orderId,
        tracking_id: trackingId,
        courier_name: 'BlueDart Express',
        expected_delivery: expectedDelivery.toISOString().split('T')[0],
        order_status: 'CONFIRMED',
      })
      .select()
      .single();
    if (error) throw error;

    await transactionService.recordTransaction({
      user_id: order.user_id,
      type: 'Direct Purchase',
      title: `Order - ${orderId}`,
      reference_id: orderId,
      payment_method: order.payment_mode || 'UPI',
      amount: order.total_amount,
      status: 'success',
    });

    return data;
  },

  async updateOrderStatus(orderId: string, status: string) {
    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
