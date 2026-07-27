import { supabase } from '@/src/lib/supabase';
import { calculateEmi, generateCaseId, addMonths } from '@/src/lib/emi';
import { creditService } from './creditService';
import { transactionService } from './transactionService';

export const emiService = {
  async submitEmiApplication(app: any) {
    const caseId = generateCaseId();
    const { data, error } = await supabase
      .from('approval_cases')
      .insert({
        ...app,
        case_id: caseId,
        current_status: 'PENDING',
        paid_installments_count: 0,
        autopay_enabled: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getEmiApplications(userId: string) {
    const { data, error } = await supabase
      .from('approval_cases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAllEmiApplications() {
    const { data, error } = await supabase
      .from('approval_cases')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateEmiStatus(caseId: string, status: string, notes?: string) {
    const { data, error } = await supabase
      .from('approval_cases')
      .update({ current_status: status, admin_notes: notes || '', updated_at: new Date().toISOString() })
      .eq('id', caseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateEmiTerms(caseId: string, terms: any) {
    const { data, error } = await supabase
      .from('approval_cases')
      .update({ ...terms, updated_at: new Date().toISOString() })
      .eq('id', caseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async pushReviewOffer(caseId: string, terms: any) {
    return this.updateEmiTerms(caseId, { ...terms, current_status: 'REVIEW' });
  },

  async approveEmi(caseId: string) {
    return this.updateEmiStatus(caseId, 'SANCTIONED');
  },

  async rejectEmi(caseId: string, reason: string) {
    return this.updateEmiStatus(caseId, 'REJECTED', reason);
  },

  async acceptOffer(caseId: string) {
    return this.updateEmiStatus(caseId, 'SANCTIONED');
  },

  async rejectOffer(caseId: string) {
    return this.updateEmiStatus(caseId, 'REJECTED');
  },

  async payDownPayment(caseId: string, userId: string, paymentMethod: string) {
    const { data: app } = await supabase
      .from('approval_cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (!app) throw new Error('Application not found');

    const { data, error } = await supabase
      .from('approval_cases')
      .update({
        down_payment_paid: true,
        current_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .select()
      .single();
    if (error) throw error;

    await this.generateSchedules(caseId, app.emi_months, app.monthly_amount);

    await transactionService.recordTransaction({
      user_id: userId,
      type: 'Down Payment',
      title: `Down Payment - ${app.case_id}`,
      reference_id: app.case_id,
      payment_method: paymentMethod,
      amount: app.down_payment,
      status: 'success',
    });

    return data;
  },

  async generateSchedules(caseId: string, months: number, monthlyAmount: number) {
    const schedules = [];
    const baseDate = new Date();
    for (let i = 1; i <= months; i++) {
      const dueDate = addMonths(baseDate, i);
      schedules.push({
        approval_case_id: caseId,
        installment_number: i,
        due_date: dueDate.toISOString().split('T')[0],
        amount: monthlyAmount,
        status: 'pending',
      });
    }
    const { error } = await supabase.from('emi_schedules').insert(schedules);
    if (error) throw error;
  },

  async getSchedules(caseId: string) {
    const { data, error } = await supabase
      .from('emi_schedules')
      .select('*')
      .eq('approval_case_id', caseId)
      .order('installment_number', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async payIndividualEmi(scheduleId: string, caseId: string, userId: string, paymentMethod: string) {
    const { data: schedule } = await supabase
      .from('emi_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
    if (!schedule) throw new Error('Schedule not found');

    const { error: schedErr } = await supabase
      .from('emi_schedules')
      .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
      .eq('id', scheduleId);
    if (schedErr) throw schedErr;

    const { data: app } = await supabase
      .from('approval_cases')
      .select('*')
      .eq('id', caseId)
      .single();

    const newCount = (app.paid_installments_count || 0) + 1;
    const allPaid = newCount >= app.emi_months;

    await supabase
      .from('approval_cases')
      .update({
        paid_installments_count: newCount,
        current_status: allPaid ? 'COMPLETED' : 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    await creditService.incrementCreditScoreOnPayment(userId);

    await transactionService.recordTransaction({
      user_id: userId,
      type: 'Monthly EMI',
      title: `EMI Payment - ${app.case_id}`,
      reference_id: app.case_id,
      payment_method: paymentMethod,
      amount: schedule.amount,
      status: 'success',
    });

    return { completed: allPaid };
  },

  async toggleAutopay(caseId: string, enabled: boolean) {
    const { data, error } = await supabase
      .from('approval_cases')
      .update({ autopay_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', caseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async checkExistingApplication(userId: string, productId: string) {
    const { data, error } = await supabase
      .from('approval_cases')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .in('current_status', ['PENDING', 'REVIEW', 'SANCTIONED', 'ACTIVE'])
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
