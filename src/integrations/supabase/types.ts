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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      additionals: {
        Row: {
          assignment_type: string | null
          capacity_value: number | null
          created_at: string
          default_value: number | null
          description: string | null
          has_implicit_task: boolean
          id: string
          is_active: boolean
          is_discount: boolean
          name: string
          organization_id: string
          price: number
          task_exclude_values: string[] | null
          task_name: string | null
          task_phase_id: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_type?: string | null
          capacity_value?: number | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          has_implicit_task?: boolean
          id?: string
          is_active?: boolean
          is_discount?: boolean
          name: string
          organization_id: string
          price?: number
          task_exclude_values?: string[] | null
          task_name?: string | null
          task_phase_id?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_type?: string | null
          capacity_value?: number | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          has_implicit_task?: boolean
          id?: string
          is_active?: boolean
          is_discount?: boolean
          name?: string
          organization_id?: string
          price?: number
          task_exclude_values?: string[] | null
          task_name?: string | null
          task_phase_id?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "additionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "additionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additionals_task_phase_id_fkey"
            columns: ["task_phase_id"]
            isOneToOne: false
            referencedRelation: "production_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      api_performance_metrics: {
        Row: {
          created_at: string
          endpoint: string | null
          error_message: string | null
          function_name: string
          id: string
          metadata: Json | null
          organization_id: string | null
          response_time_ms: number
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          response_time_ms: number
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          response_time_ms?: number
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_performance_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "api_performance_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      components: {
        Row: {
          component_type: string
          created_at: string
          description: string | null
          easyquote_product_id: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          component_type?: string
          created_at?: string
          description?: string | null
          easyquote_product_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          component_type?: string
          created_at?: string
          description?: string | null
          easyquote_product_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      composite_output_aggregations: {
        Row: {
          aggregation_type: string
          composite_product_id: string
          created_at: string
          id: string
          organization_id: string
          source_output_name: string
          target_output_label: string
          target_output_name: string
          updated_at: string
        }
        Insert: {
          aggregation_type?: string
          composite_product_id: string
          created_at?: string
          id?: string
          organization_id: string
          source_output_name: string
          target_output_label: string
          target_output_name: string
          updated_at?: string
        }
        Update: {
          aggregation_type?: string
          composite_product_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          source_output_name?: string
          target_output_label?: string
          target_output_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      composite_product_components: {
        Row: {
          component_alias: string
          component_product_id: string
          composite_product_id: string
          created_at: string
          display_order: number
          id: string
          is_final_calculation: boolean
          is_optional: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          component_alias: string
          component_product_id: string
          composite_product_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_final_calculation?: boolean
          is_optional?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          component_alias?: string
          component_product_id?: string
          composite_product_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_final_calculation?: boolean
          is_optional?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      composite_product_outputs: {
        Row: {
          created_at: string
          display_order: number
          easyquote_product_id: string
          formula: string | null
          id: string
          label: string
          name: string
          organization_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          easyquote_product_id: string
          formula?: string | null
          id?: string
          label: string
          name: string
          organization_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          easyquote_product_id?: string
          formula?: string | null
          id?: string
          label?: string
          name?: string
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      composite_product_prompts: {
        Row: {
          created_at: string
          default_value: string | null
          display_order: number
          easyquote_product_id: string
          id: string
          is_required: boolean
          label: string
          name: string
          options: Json | null
          organization_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          easyquote_product_id: string
          id?: string
          is_required?: boolean
          label: string
          name: string
          options?: Json | null
          organization_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          easyquote_product_id?: string
          id?: string
          is_required?: boolean
          label?: string
          name?: string
          options?: Json | null
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      composite_prompt_connections: {
        Row: {
          composite_product_id: string
          created_at: string
          id: string
          organization_id: string
          source_prompt_name: string
          target_component_id: string
          target_prompt_name: string
          transform_formula: string | null
          updated_at: string
        }
        Insert: {
          composite_product_id: string
          created_at?: string
          id?: string
          organization_id: string
          source_prompt_name: string
          target_component_id: string
          target_prompt_name: string
          transform_formula?: string | null
          updated_at?: string
        }
        Update: {
          composite_product_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          source_prompt_name?: string
          target_component_id?: string
          target_prompt_name?: string
          transform_formula?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_access_logs: {
        Row: {
          accessed_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          operation: string
          record_count: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operation: string
          record_count?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operation?: string
          record_count?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_access_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          holded_id: string | null
          id: string
          integration_id: string | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          holded_id?: string | null
          id?: string
          integration_id?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          holded_id?: string | null
          id?: string
          integration_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      default_production_tasks: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          organization_id: string
          phase_id: string
          task_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          organization_id: string
          phase_id: string
          task_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          phase_id?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_production_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "default_production_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_production_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "production_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      development_sprints: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      development_tasks: {
        Row: {
          actual_hours: number | null
          category: string
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          notes: string | null
          priority: string
          related_version: string | null
          sort_order: number | null
          sprint_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          category: string
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          priority?: string
          related_version?: string | null
          sort_order?: number | null
          sprint_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          priority?: string
          related_version?: string | null
          sort_order?: number | null
          sprint_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "development_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          document_type: string
          last_number: number
          organization_id: string
          updated_at: string
          year: number
        }
        Insert: {
          document_type: string
          last_number?: number
          organization_id: string
          updated_at?: string
          year?: number
        }
        Update: {
          document_type?: string
          last_number?: number
          organization_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      easyquote_credentials: {
        Row: {
          api_password_encrypted: string
          api_username_encrypted: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_password_encrypted: string
          api_username_encrypted: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_password_encrypted?: string
          api_username_encrypted?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      excel_files: {
        Row: {
          created_at: string
          error_message: string | null
          file_id: string
          file_size: number
          filename: string
          id: string
          is_master: boolean | null
          mime_type: string | null
          original_filename: string
          processed: boolean
          updated_at: string
          upload_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_id: string
          file_size?: number
          filename: string
          id?: string
          is_master?: boolean | null
          mime_type?: string | null
          original_filename: string
          processed?: boolean
          updated_at?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_id?: string
          file_size?: number
          filename?: string
          id?: string
          is_master?: boolean | null
          mime_type?: string | null
          original_filename?: string
          processed?: boolean
          updated_at?: string
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
      holded_sales_accounts: {
        Row: {
          account_num: number | null
          color: string | null
          created_at: string
          holded_account_id: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_num?: number | null
          color?: string | null
          created_at?: string
          holded_account_id: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_num?: number | null
          color?: string | null
          created_at?: string
          holded_account_id?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holded_sales_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "holded_sales_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      image_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "image_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      image_category_assignments: {
        Row: {
          category_id: string
          created_at: string
          easyquote_image_id: string
          id: string
          organization_id: string
          subcategory_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          easyquote_image_id: string
          id?: string
          organization_id: string
          subcategory_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          easyquote_image_id?: string
          id?: string
          organization_id?: string
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "image_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_category_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "image_category_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_category_assignments_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "image_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      image_subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "image_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_subcategories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "image_subcategories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          file_size: number
          filename: string
          height: number | null
          id: string
          is_active: boolean
          mime_type: string
          organization_id: string | null
          original_filename: string
          storage_path: string
          tags: string[] | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          file_size?: number
          filename: string
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type: string
          organization_id?: string | null
          original_filename: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          file_size?: number
          filename?: string
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string
          organization_id?: string | null
          original_filename?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "images_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "image_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "images_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          configuration: Json | null
          created_at: string
          description: string | null
          id: string
          integration_type: string | null
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          integration_type?: string | null
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          integration_type?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      numbering_formats: {
        Row: {
          created_at: string
          document_type: string
          id: string
          last_sequential_number: number
          organization_id: string | null
          prefix: string
          sequential_digits: number
          suffix: string | null
          updated_at: string
          use_year: boolean
          user_id: string
          year_format: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          last_sequential_number?: number
          organization_id?: string | null
          prefix?: string
          sequential_digits?: number
          suffix?: string | null
          updated_at?: string
          use_year?: boolean
          user_id: string
          year_format?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          last_sequential_number?: number
          organization_id?: string | null
          prefix?: string
          sequential_digits?: number
          suffix?: string | null
          updated_at?: string
          use_year?: boolean
          user_id?: string
          year_format?: string
        }
        Relationships: [
          {
            foreignKeyName: "numbering_formats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "numbering_formats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_api_credentials: {
        Row: {
          api_key: string | null
          api_key_encrypted: string | null
          api_secret: string | null
          api_secret_encrypted: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_used_at: string | null
          organization_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          api_key?: string | null
          api_key_encrypted?: string | null
          api_secret?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          api_key?: string | null
          api_key_encrypted?: string | null
          api_secret?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_integration_access: {
        Row: {
          access_token_encrypted: string | null
          configuration: Json | null
          created_at: string
          expires_at: string | null
          generate_pdfs: boolean
          id: string
          integration_id: string
          is_active: boolean
          organization_id: string
          refresh_token_encrypted: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          configuration?: Json | null
          created_at?: string
          expires_at?: string | null
          generate_pdfs?: boolean
          id?: string
          integration_id: string
          is_active?: boolean
          organization_id: string
          refresh_token_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          configuration?: Json | null
          created_at?: string
          expires_at?: string | null
          generate_pdfs?: boolean
          id?: string
          integration_id?: string
          is_active?: boolean
          organization_id?: string
          refresh_token_encrypted?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_integration_access_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_integration_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_integration_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          cuenta_holded: string | null
          display_name: string | null
          id: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuenta_holded?: string | null
          display_name?: string | null
          id?: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuenta_holded?: string | null
          display_name?: string | null
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_themes: {
        Row: {
          accent_color: string
          accent_foreground: string
          created_at: string
          id: string
          is_active: boolean
          muted_color: string | null
          muted_foreground: string | null
          name: string
          organization_id: string
          primary_color: string
          primary_foreground: string
          secondary_color: string
          secondary_foreground: string
          sidebar_accent: string | null
          sidebar_accent_foreground: string | null
          sidebar_background: string | null
          sidebar_foreground: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          accent_foreground?: string
          created_at?: string
          id?: string
          is_active?: boolean
          muted_color?: string | null
          muted_foreground?: string | null
          name?: string
          organization_id: string
          primary_color?: string
          primary_foreground?: string
          secondary_color?: string
          secondary_foreground?: string
          sidebar_accent?: string | null
          sidebar_accent_foreground?: string | null
          sidebar_background?: string | null
          sidebar_foreground?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          accent_foreground?: string
          created_at?: string
          id?: string
          is_active?: boolean
          muted_color?: string | null
          muted_foreground?: string | null
          name?: string
          organization_id?: string
          primary_color?: string
          primary_foreground?: string
          secondary_color?: string
          secondary_foreground?: string
          sidebar_accent?: string | null
          sidebar_accent_foreground?: string | null
          sidebar_background?: string | null
          sidebar_foreground?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_themes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_themes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          api_user_id: string
          client_user_extra: number
          client_user_limit: number
          created_at: string
          excel_extra: number
          excel_limit: number
          holded_external_customers: boolean
          id: string
          max_daily_orders: number | null
          name: string
          subscription_plan: string
          updated_at: string
        }
        Insert: {
          api_user_id: string
          client_user_extra?: number
          client_user_limit?: number
          created_at?: string
          excel_extra?: number
          excel_limit?: number
          holded_external_customers?: boolean
          id?: string
          max_daily_orders?: number | null
          name: string
          subscription_plan?: string
          updated_at?: string
        }
        Update: {
          api_user_id?: string
          client_user_extra?: number
          client_user_limit?: number
          created_at?: string
          excel_extra?: number
          excel_limit?: number
          holded_external_customers?: boolean
          id?: string
          max_daily_orders?: number | null
          name?: string
          subscription_plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_configurations: {
        Row: {
          brand_color: string | null
          company_name: string | null
          created_at: string
          footer_text: string | null
          id: string
          logo_url: string | null
          organization_id: string | null
          selected_template: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_color?: string | null
          company_name?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          selected_template?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_color?: string | null
          company_name?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          selected_template?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_custom: boolean
          is_global: boolean
          name: string
          organization_id: string | null
          price: number | null
          template_number: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          is_global?: boolean
          name: string
          organization_id?: string | null
          price?: number | null
          template_number: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          is_global?: boolean
          name?: string
          organization_id?: string | null
          price?: number | null
          template_number?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pdf_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_configurations: {
        Row: {
          available_modules: string[] | null
          client_user_limit: number
          created_at: string
          description: string | null
          excel_limit: number
          id: string
          is_active: boolean
          name: string
          plan_id: string
          price: number | null
          updated_at: string
        }
        Insert: {
          available_modules?: string[] | null
          client_user_limit?: number
          created_at?: string
          description?: string | null
          excel_limit?: number
          id?: string
          is_active?: boolean
          name: string
          plan_id: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          available_modules?: string[] | null
          client_user_limit?: number
          created_at?: string
          description?: string | null
          excel_limit?: number
          id?: string
          is_active?: boolean
          name?: string
          plan_id?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_category_mappings: {
        Row: {
          category_id: string | null
          created_at: string
          easyquote_product_id: string
          id: string
          product_name: string
          subcategory_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          easyquote_product_id: string
          id?: string
          product_name: string
          subcategory_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          easyquote_product_id?: string
          id?: string
          product_name?: string
          subcategory_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_mappings_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_component_settings: {
        Row: {
          created_at: string
          easyquote_product_id: string
          enabled_components: string[]
          id: string
          is_component: boolean
          is_composite: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          easyquote_product_id: string
          enabled_components?: string[]
          id?: string
          is_component?: boolean
          is_composite?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          easyquote_product_id?: string
          enabled_components?: string[]
          id?: string
          is_component?: boolean
          is_composite?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_component_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_component_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_output_order: {
        Row: {
          created_at: string
          easyquote_product_id: string
          id: string
          organization_id: string
          output_order: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          easyquote_product_id: string
          id?: string
          organization_id: string
          output_order?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          easyquote_product_id?: string
          id?: string
          organization_id?: string
          output_order?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_output_order_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_output_order_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prompt_components: {
        Row: {
          component: string
          created_at: string
          easyquote_product_id: string
          id: string
          organization_id: string
          prompt_name: string
          updated_at: string
        }
        Insert: {
          component: string
          created_at?: string
          easyquote_product_id: string
          id?: string
          organization_id: string
          prompt_name: string
          updated_at?: string
        }
        Update: {
          component?: string
          created_at?: string
          easyquote_product_id?: string
          id?: string
          organization_id?: string
          prompt_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prompt_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_prompt_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prompt_settings: {
        Row: {
          admin_only: boolean
          created_at: string
          easyquote_product_id: string
          force_result: boolean
          hide_in_documents: boolean
          id: string
          organization_id: string
          prompt_name: string
          updated_at: string
        }
        Insert: {
          admin_only?: boolean
          created_at?: string
          easyquote_product_id: string
          force_result?: boolean
          hide_in_documents?: boolean
          id?: string
          organization_id: string
          prompt_name: string
          updated_at?: string
        }
        Update: {
          admin_only?: boolean
          created_at?: string
          easyquote_product_id?: string
          force_result?: boolean
          hide_in_documents?: boolean
          id?: string
          organization_id?: string
          prompt_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prompt_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_prompt_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variable_mappings: {
        Row: {
          created_at: string
          easyquote_product_id: string
          id: string
          organization_id: string
          product_name: string
          production_variable_id: string
          prompt_or_output_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          easyquote_product_id: string
          id?: string
          organization_id: string
          product_name: string
          production_variable_id: string
          prompt_or_output_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          easyquote_product_id?: string
          id?: string
          organization_id?: string
          product_name?: string
          production_variable_id?: string
          prompt_or_output_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variable_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "product_variable_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variable_mappings_production_variable_id_fkey"
            columns: ["production_variable_id"]
            isOneToOne: false
            referencedRelation: "production_variables"
            referencedColumns: ["id"]
          },
        ]
      }
      production_phases: {
        Row: {
          color: string | null
          created_at: string | null
          display_name: string
          display_order: number
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_name: string
          display_order: number
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_name?: string
          display_order?: number
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      production_tasks: {
        Row: {
          comments: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          operator_id: string
          paused_at: string | null
          phase_id: string
          sales_order_item_id: string
          started_at: string | null
          status: string | null
          task_name: string
          total_time_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          operator_id: string
          paused_at?: string | null
          phase_id: string
          sales_order_item_id: string
          started_at?: string | null
          status?: string | null
          task_name: string
          total_time_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          operator_id?: string
          paused_at?: string | null
          phase_id?: string
          sales_order_item_id?: string
          started_at?: string | null
          status?: string | null
          task_name?: string
          total_time_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "production_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_variables: {
        Row: {
          created_at: string
          description: string | null
          has_implicit_task: boolean
          id: string
          is_active: boolean
          name: string
          organization_id: string
          task_exclude_values: string[] | null
          task_name: string | null
          task_phase_id: string | null
          updated_at: string
          variable_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          has_implicit_task?: boolean
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          task_exclude_values?: string[] | null
          task_name?: string | null
          task_phase_id?: string | null
          updated_at?: string
          variable_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          has_implicit_task?: boolean
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          task_exclude_values?: string[] | null
          task_name?: string | null
          task_phase_id?: string | null
          updated_at?: string
          variable_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "production_variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_variables_task_phase_id_fkey"
            columns: ["task_phase_id"]
            isOneToOne: false
            referencedRelation: "production_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          custom_colors: Json | null
          first_name: string | null
          id: string
          last_name: string | null
          production_board_view: string | null
          selected_theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_colors?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          production_board_view?: string | null
          selected_theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_colors?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          production_board_view?: string | null
          selected_theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_additionals: {
        Row: {
          additional_id: string | null
          created_at: string
          id: string
          is_discount: boolean
          name: string
          quote_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name: string
          quote_id: string
          type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name?: string
          quote_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_additionals_additional_id_fkey"
            columns: ["additional_id"]
            isOneToOne: false
            referencedRelation: "additionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_additionals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          accepted: boolean | null
          accepted_quantity: number | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          id: string
          item_additionals: Json | null
          multi: Json | null
          name: string | null
          outputs: Json | null
          position: number | null
          price: number
          product_id: string | null
          product_name: string | null
          prompts: Json | null
          quantity: number | null
          quote_id: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          accepted_quantity?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          item_additionals?: Json | null
          multi?: Json | null
          name?: string | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name?: string | null
          prompts?: Json | null
          quantity?: number | null
          quote_id: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          accepted_quantity?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          item_additionals?: Json | null
          multi?: Json | null
          name?: string | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name?: string | null
          prompts?: Json | null
          quantity?: number | null
          quote_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          discount_amount: number
          final_price: number
          hide_holded_totals: boolean
          holded_estimate_id: string | null
          holded_estimate_number: string | null
          id: string
          notes: string | null
          organization_id: string | null
          product_name: string | null
          quote_additionals: Json | null
          quote_number: string
          selections: Json | null
          status: string
          subtotal: number
          tax_amount: number
          terms_conditions: string | null
          title: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          hide_holded_totals?: boolean
          holded_estimate_id?: string | null
          holded_estimate_number?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          product_name?: string | null
          quote_additionals?: Json | null
          quote_number: string
          selections?: Json | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          hide_holded_totals?: boolean
          holded_estimate_id?: string | null
          holded_estimate_number?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          product_name?: string | null
          quote_additionals?: Json | null
          quote_number?: string
          selections?: Json | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_additionals: {
        Row: {
          additional_id: string | null
          created_at: string
          id: string
          is_discount: boolean
          name: string
          sales_order_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name: string
          sales_order_id: string
          type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name?: string
          sales_order_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_additionals_additional_id_fkey"
            columns: ["additional_id"]
            isOneToOne: false
            referencedRelation: "additionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_additionals_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          imposition_data: Json | null
          multi: Json | null
          outputs: Json | null
          position: number | null
          price: number
          product_id: string | null
          product_name: string
          production_status: string | null
          prompts: Json | null
          quantity: number
          sales_order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          imposition_data?: Json | null
          multi?: Json | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name: string
          production_status?: string | null
          prompts?: Json | null
          quantity?: number
          sales_order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          imposition_data?: Json | null
          multi?: Json | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name?: string
          production_status?: string | null
          prompts?: Json | null
          quantity?: number
          sales_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_from_scratch: boolean
          customer_id: string | null
          delivery_date: string | null
          description: string | null
          discount_amount: number
          final_price: number
          holded_document_id: string | null
          holded_document_number: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          organization_id: string | null
          production_progress: Json | null
          quote_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          terms_conditions: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_from_scratch?: boolean
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          holded_document_id?: string | null
          holded_document_number?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          organization_id?: string | null
          production_progress?: Json | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_from_scratch?: boolean
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          holded_document_id?: string | null
          holded_document_number?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          organization_id?: string | null
          production_progress?: Json | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      woocommerce_product_links: {
        Row: {
          created_at: string
          easyquote_product_id: string
          easyquote_product_name: string
          id: string
          is_linked: boolean
          last_synced_at: string
          organization_id: string
          product_count: number
          updated_at: string
          woo_products: Json
        }
        Insert: {
          created_at?: string
          easyquote_product_id: string
          easyquote_product_name: string
          id?: string
          is_linked?: boolean
          last_synced_at?: string
          organization_id: string
          product_count?: number
          updated_at?: string
          woo_products?: Json
        }
        Update: {
          created_at?: string
          easyquote_product_id?: string
          easyquote_product_name?: string
          id?: string
          is_linked?: boolean
          last_synced_at?: string
          organization_id?: string
          product_count?: number
          updated_at?: string
          woo_products?: Json
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_product_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_daily_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "woocommerce_product_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_performance_summary: {
        Row: {
          avg_response_time: number | null
          date: string | null
          error_count: number | null
          function_name: string | null
          max_response_time: number | null
          min_response_time: number | null
          p95_response_time: number | null
          total_calls: number | null
        }
        Relationships: []
      }
      organization_daily_stats: {
        Row: {
          date: string | null
          orders_count: number | null
          organization_id: string | null
          organization_name: string | null
          quotes_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_organization_api_credential: {
        Args: {
          p_api_key: string
          p_api_secret: string
          p_organization_id: string
        }
        Returns: string
      }
      decrypt_credential: { Args: { encrypted_data: string }; Returns: string }
      detect_suspicious_customer_access: {
        Args: { threshold?: number; time_window_minutes?: number }
        Returns: {
          access_count: number
          first_access: string
          last_access: string
          user_id: string
        }[]
      }
      encrypt_credential: { Args: { credential_text: string }; Returns: string }
      generate_api_key: { Args: never; Returns: string }
      generate_api_secret: { Args: never; Returns: string }
      generate_sales_order_number: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          role: string
          user_id: string
        }[]
      }
      get_customer_audit_trail: {
        Args: { p_customer_id: string; p_limit?: number }
        Returns: {
          accessed_at: string
          id: string
          metadata: Json
          operation: string
          user_id: string
        }[]
      }
      get_organization_api_credentials: {
        Args: { p_organization_id: string }
        Returns: {
          api_key: string
          api_secret: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string
          usage_count: number
        }[]
      }
      get_organization_easyquote_credentials: {
        Args: { p_user_id: string }
        Returns: {
          api_password: string
          api_username: string
          created_at: string
          id: string
          updated_at: string
        }[]
      }
      get_user_credentials: {
        Args: { p_user_id: string }
        Returns: {
          api_password: string
          api_username: string
          created_at: string
          id: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_organization_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: never; Returns: boolean }
      next_document_number: {
        Args: { p_document_type: string; p_organization_id: string }
        Returns: {
          document_number: string
          sequential_number: number
        }[]
      }
      search_customers: {
        Args: {
          page_limit?: number
          page_offset?: number
          search_term: string
          user_uuid: string
        }
        Returns: {
          created_at: string
          email: string
          holded_id: string
          id: string
          name: string
          phone: string
        }[]
      }
      set_user_credentials: {
        Args: { p_password: string; p_user_id: string; p_username: string }
        Returns: string
      }
      update_last_sequential_number:
        | {
            Args: { p_document_type: string; p_user_id: string }
            Returns: number
          }
        | {
            Args: {
              p_document_type: string
              p_organization_id?: string
              p_user_id: string
            }
            Returns: number
          }
      validate_api_key: { Args: { p_api_key: string }; Returns: string }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "comercial" | "operador" | "gestor"
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
    Enums: {
      app_role: ["superadmin", "admin", "comercial", "operador", "gestor"],
    },
  },
} as const
