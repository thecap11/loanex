import { supabase } from '@/src/lib/supabase';

export const productService = {
  async getProducts(filters?: { category?: string; search?: string; flashDeals?: boolean; bestSellers?: boolean }) {
    let query = supabase.from('products').select('*');
    if (filters?.category && filters.category !== 'All') {
      query = query.eq('category_id', filters.category);
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`);
    }
    if (filters?.flashDeals) {
      query = query.eq('is_flash_deal', true);
    }
    if (filters?.bestSellers) {
      query = query.eq('is_best_seller', true);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getProduct(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createProduct(product: any) {
    const { data, error } = await supabase.from('products').insert(product).select().single();
    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, updates: any) {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  async getCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async createCategory(cat: any) {
    const { data, error } = await supabase.from('categories').insert(cat).select().single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id: string, updates: any) {
    const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  async getReviews(productId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async postReview(review: any) {
    const { data, error } = await supabase.from('reviews').insert(review).select().single();
    if (error) throw error;
    return data;
  },
};
