export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          presence_date: string
          status: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          presence_date: string
          status: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          presence_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          age: number | null
          contract_url: string | null
          cpf: string | null
          created_at: string
          hire_date: string
          id: string
          job_function: string | null
          name: string
          payment_type: string
          pix_key: string | null
          salary: number
          status: string
        }
        Insert: {
          age?: number | null
          contract_url?: string | null
          cpf?: string | null
          created_at?: string
          hire_date?: string
          id?: string
          job_function?: string | null
          name: string
          payment_type?: string
          pix_key?: string | null
          salary?: number
          status?: string
        }
        Update: {
          age?: number | null
          contract_url?: string | null
          cpf?: string | null
          created_at?: string
          hire_date?: string
          id?: string
          job_function?: string | null
          name?: string
          payment_type?: string
          pix_key?: string | null
          salary?: number
          status?: string
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          monthly_amount: number
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          name?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          cost_per_unit: number
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          last_purchase_date: string | null
          last_purchase_price: number | null
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          min_stock?: number
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          min_stock?: number
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      material_purchases: {
        Row: {
          created_at: string
          id: string
          material_name: string
          purchase_date: string
          quantity: number
          supplier: string | null
          total_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          total_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          total_cost?: number
          unit_price?: number
        }
        Relationships: []
      }
      monthly_closings: {
        Row: {
          ai_report: string | null
          closing_month: number
          closing_year: number
          created_at: string
          employee_details: Json | null
          id: string
          margin: number
          net_profit: number
          total_expenses: number
          total_revenue: number
          total_salaries: number
          total_vales: number
        }
        Insert: {
          ai_report?: string | null
          closing_month: number
          closing_year: number
          created_at?: string
          employee_details?: Json | null
          id?: string
          margin?: number
          net_profit?: number
          total_expenses?: number
          total_revenue?: number
          total_salaries?: number
          total_vales?: number
        }
        Update: {
          ai_report?: string | null
          closing_month?: number
          closing_year?: number
          created_at?: string
          employee_details?: Json | null
          id?: string
          margin?: number
          net_profit?: number
          total_expenses?: number
          total_revenue?: number
          total_salaries?: number
          total_vales?: number
        }
        Relationships: []
      }
      product_materials: {
        Row: {
          created_at: string
          id: string
          material_name: string
          product_id: string
          quantity_per_unit: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          product_id: string
          quantity_per_unit?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          product_id?: string
          quantity_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          labor_cost: number
          material_cost: number
          name: string
          other_costs: number
          sale_price: number
          units_sold: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          labor_cost?: number
          material_cost?: number
          name: string
          other_costs?: number
          sale_price?: number
          units_sold?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          labor_cost?: number
          material_cost?: number
          name?: string
          other_costs?: number
          sale_price?: number
          units_sold?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          atendimento_data: string
          atendimento_hora: string | null
          cliente_contato: string | null
          cliente_cpf_cnpj: string | null
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          desconto: number
          descricao_pagamento: string | null
          empresa_cnpj: string | null
          empresa_email: string | null
          empresa_endereco: string | null
          empresa_nome: string
          empresa_telefone: string | null
          forma_pagamento: string | null
          id: string
          items: Json
          observacoes: string | null
          os_number: string
          subtotal: number
          total: number
          user_id: string
          vendedor: string | null
        }
        Insert: {
          atendimento_data?: string
          atendimento_hora?: string | null
          cliente_contato?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          desconto?: number
          descricao_pagamento?: string | null
          empresa_cnpj?: string | null
          empresa_email?: string | null
          empresa_endereco?: string | null
          empresa_nome?: string
          empresa_telefone?: string | null
          forma_pagamento?: string | null
          id?: string
          items?: Json
          observacoes?: string | null
          os_number?: string
          subtotal?: number
          total?: number
          user_id: string
          vendedor?: string | null
        }
        Update: {
          atendimento_data?: string
          atendimento_hora?: string | null
          cliente_contato?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          desconto?: number
          descricao_pagamento?: string | null
          empresa_cnpj?: string | null
          empresa_email?: string | null
          empresa_endereco?: string | null
          empresa_nome?: string
          empresa_telefone?: string | null
          forma_pagamento?: string | null
          id?: string
          items?: Json
          observacoes?: string | null
          os_number?: string
          subtotal?: number
          total?: number
          user_id?: string
          vendedor?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          id: string
          payment_method: string
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          payment_method?: string
          transaction_date?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          payment_method?: string
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vales: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          employee_id: string
          id: string
          vale_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          vale_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          vale_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "vales_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_costs: {
        Row: {
          created_at: string
          description: string
          id: string
          notes: string | null
          part_name: string
          product_id: string | null
          quantity: number
          shipping_cost: number
          total_cost: number
          unit_cost: number
          warranty_date: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          part_name: string
          product_id?: string | null
          quantity?: number
          shipping_cost?: number
          total_cost?: number
          unit_cost?: number
          warranty_date?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          part_name?: string
          product_id?: string | null
          quantity?: number
          shipping_cost?: number
          total_cost?: number
          unit_cost?: number
          warranty_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
