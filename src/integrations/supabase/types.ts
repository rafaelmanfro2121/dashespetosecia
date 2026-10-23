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
          late_hours: number
          presence_date: string
          status: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          late_hours?: number
          presence_date: string
          status: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          late_hours?: number
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
      email_automation_logs: {
        Row: {
          dia_trigger: number
          enviado_em: string
          erro_mensagem: string | null
          id: string
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          dia_trigger: number
          enviado_em?: string
          erro_mensagem?: string | null
          id?: string
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          dia_trigger?: number
          enviado_em?: string
          erro_mensagem?: string | null
          id?: string
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_automation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_templates: {
        Row: {
          assunto: string
          ativo: boolean
          conteudo_html: string
          created_at: string
          dia_trigger: number
          id: string
          updated_at: string
        }
        Insert: {
          assunto: string
          ativo?: boolean
          conteudo_html: string
          created_at?: string
          dia_trigger: number
          id?: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          conteudo_html?: string
          created_at?: string
          dia_trigger?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_automation_users: {
        Row: {
          automacao_ativa: boolean
          created_at: string
          data_cadastro: string
          email: string
          id: string
          nome: string | null
          pacientes_cadastrados: number
          pausado: boolean
          sessoes_registradas: number
          updated_at: string
          user_id: string
          usuario_ativado: boolean
        }
        Insert: {
          automacao_ativa?: boolean
          created_at?: string
          data_cadastro: string
          email: string
          id?: string
          nome?: string | null
          pacientes_cadastrados?: number
          pausado?: boolean
          sessoes_registradas?: number
          updated_at?: string
          user_id: string
          usuario_ativado?: boolean
        }
        Update: {
          automacao_ativa?: boolean
          created_at?: string
          data_cadastro?: string
          email?: string
          id?: string
          nome?: string | null
          pacientes_cadastrados?: number
          pausado?: boolean
          sessoes_registradas?: number
          updated_at?: string
          user_id?: string
          usuario_ativado?: boolean
        }
        Relationships: []
      }
      email_marketing_campaigns: {
        Row: {
          created_at: string
          enviados_hoje: number
          horario_fim: string
          horario_inicio: string
          id: string
          limite_diario: number
          nome: string
          status: string
          template_id: string | null
          ultimo_envio_dia: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enviados_hoje?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          limite_diario?: number
          nome: string
          status?: string
          template_id?: string | null
          ultimo_envio_dia?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enviados_hoje?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          limite_diario?: number
          nome?: string
          status?: string
          template_id?: string | null
          ultimo_envio_dia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          nome: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          nome?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          nome?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_templates: {
        Row: {
          assunto: string
          conteudo_html: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          assunto: string
          conteudo_html: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          conteudo_html?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
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
      historical_sales: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_documento: string | null
          cliente_email: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string
          endereco: string | null
          id: string
          issued_at: string | null
          natureza: string | null
          nf_key: string
          nf_number: string | null
          source_file: string | null
          total: number
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          issued_at?: string | null
          natureza?: string | null
          nf_key: string
          nf_number?: string | null
          source_file?: string | null
          total?: number
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          issued_at?: string | null
          natureza?: string | null
          nf_key?: string
          nf_number?: string | null
          source_file?: string | null
          total?: number
          uf?: string | null
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
      lead_feedback: {
        Row: {
          created_at: string
          id: string
          page_path: string | null
          reason: string
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path?: string | null
          reason: string
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string | null
          reason?: string
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      marketing_enviados_log: {
        Row: {
          destinatario: string
          enviado_em: string
          id: string
          nome: string | null
          template_usado: string | null
          tipo: string
        }
        Insert: {
          destinatario: string
          enviado_em?: string
          id?: string
          nome?: string | null
          template_usado?: string | null
          tipo: string
        }
        Update: {
          destinatario?: string
          enviado_em?: string
          id?: string
          nome?: string | null
          template_usado?: string | null
          tipo?: string
        }
        Relationships: []
      }
      marketing_schedule_settings: {
        Row: {
          channel: string
          created_at: string
          daily_limit: number
          end_time: string
          hourly_limit: number
          id: string
          interval_seconds: number
          is_active: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          daily_limit?: number
          end_time?: string
          hourly_limit?: number
          id?: string
          interval_seconds?: number
          is_active?: boolean
          start_time?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          daily_limit?: number
          end_time?: string
          hourly_limit?: number
          id?: string
          interval_seconds?: number
          is_active?: boolean
          start_time?: string
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
      salary_payments: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          paid_at: string
          payment_month: number
          payment_year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          paid_at?: string
          payment_month: number
          payment_year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          paid_at?: string
          payment_month?: number
          payment_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          atendimento_data: string
          atendimento_hora: string | null
          cliente_contato: string | null
          cliente_cpf_cnpj: string | null
          cliente_email: string | null
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
          meta_capi_attempted_at: string | null
          meta_capi_error: string | null
          meta_capi_event_time: string | null
          meta_capi_sent_at: string | null
          meta_capi_status: string | null
          nota_fiscal_url: string | null
          observacoes: string | null
          order_status: string
          os_number: string
          os_tecnica_data: Json | null
          os_tecnica_salva: boolean
          paid_amount: number
          payment_method_client: string
          payment_status: string
          payments: Json
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
          cliente_email?: string | null
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
          meta_capi_attempted_at?: string | null
          meta_capi_error?: string | null
          meta_capi_event_time?: string | null
          meta_capi_sent_at?: string | null
          meta_capi_status?: string | null
          nota_fiscal_url?: string | null
          observacoes?: string | null
          order_status?: string
          os_number?: string
          os_tecnica_data?: Json | null
          os_tecnica_salva?: boolean
          paid_amount?: number
          payment_method_client?: string
          payment_status?: string
          payments?: Json
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
          cliente_email?: string | null
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
          meta_capi_attempted_at?: string | null
          meta_capi_error?: string | null
          meta_capi_event_time?: string | null
          meta_capi_sent_at?: string | null
          meta_capi_status?: string | null
          nota_fiscal_url?: string | null
          observacoes?: string | null
          order_status?: string
          os_number?: string
          os_tecnica_data?: Json | null
          os_tecnica_salva?: boolean
          paid_amount?: number
          payment_method_client?: string
          payment_status?: string
          payments?: Json
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      whatsapp_marketing_campaigns: {
        Row: {
          created_at: string
          enviados_hoje: number
          horario_fim: string
          horario_inicio: string
          id: string
          limite_diario: number
          nome: string
          status: string
          template_id: string | null
          ultimo_envio_dia: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enviados_hoje?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          limite_diario?: number
          nome: string
          status?: string
          template_id?: string | null
          ultimo_envio_dia?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enviados_hoje?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          limite_diario?: number
          nome?: string
          status?: string
          template_id?: string | null
          ultimo_envio_dia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_marketing_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_marketing_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          is_validated: boolean
          nome: string | null
          status: string
          telefone: string
          whatsapp_exists: boolean | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          is_validated?: boolean
          nome?: string | null
          status?: string
          telefone: string
          whatsapp_exists?: boolean | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          is_validated?: boolean
          nome?: string | null
          status?: string
          telefone?: string
          whatsapp_exists?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_marketing_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_marketing_templates: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          image_url: string | null
          link_url: string | null
          nome: string
          pre_link_message: string | null
          updated_at: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          nome: string
          pre_link_message?: string | null
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          nome?: string
          pre_link_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
