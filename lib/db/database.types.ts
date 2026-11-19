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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_schedule: {
        Row: {
          custom_factor: number | null
          level: string | null
          mode: string
          steps_target: number | null
          user_id: string
          weekday: number
        }
        Insert: {
          custom_factor?: number | null
          level?: string | null
          mode: string
          steps_target?: number | null
          user_id: string
          weekday: number
        }
        Update: {
          custom_factor?: number | null
          level?: string | null
          mode?: string
          steps_target?: number | null
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      activity_type: {
        Row: {
          category: string
          code: string
          id: number
          met: number
          name_es: string
        }
        Insert: {
          category: string
          code: string
          id?: never
          met: number
          name_es: string
        }
        Update: {
          category?: string
          code?: string
          id?: never
          met?: number
          name_es?: string
        }
        Relationships: []
      }
      body_measurement: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          measured_at: string
          note: string | null
          user_id: string
          waist_cm: number | null
          weight_kg: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measured_at?: string
          note?: string | null
          user_id: string
          waist_cm?: number | null
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measured_at?: string
          note?: string | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          custom_factor: number | null
          day: string
          level: string | null
          mode: string
          steps_actual: number | null
          user_id: string
        }
        Insert: {
          custom_factor?: number | null
          day: string
          level?: string | null
          mode: string
          steps_actual?: number | null
          user_id: string
        }
        Update: {
          custom_factor?: number | null
          day?: string
          level?: string | null
          mode?: string
          steps_actual?: number | null
          user_id?: string
        }
        Relationships: []
      }
      favorite_food: {
        Row: {
          created_at: string
          food_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_food_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
        ]
      }
      food: {
        Row: {
          barcode: string | null
          basis: string
          brand: string | null
          category: string | null
          density_g_ml: number | null
          id: string
          imported_at: string
          license: string | null
          name_en: string | null
          name_es: string
          owner_user_id: string | null
          search_vector: unknown
          source: string
          source_id: string | null
          state: string
        }
        Insert: {
          barcode?: string | null
          basis?: string
          brand?: string | null
          category?: string | null
          density_g_ml?: number | null
          id?: string
          imported_at?: string
          license?: string | null
          name_en?: string | null
          name_es: string
          owner_user_id?: string | null
          search_vector?: unknown
          source: string
          source_id?: string | null
          state?: string
        }
        Update: {
          barcode?: string | null
          basis?: string
          brand?: string | null
          category?: string | null
          density_g_ml?: number | null
          id?: string
          imported_at?: string
          license?: string | null
          name_en?: string | null
          name_es?: string
          owner_user_id?: string | null
          search_vector?: unknown
          source?: string
          source_id?: string | null
          state?: string
        }
        Relationships: []
      }
      food_nutrient: {
        Row: {
          amount_per_100: number
          food_id: string
          nutrient_id: number
        }
        Insert: {
          amount_per_100: number
          food_id: string
          nutrient_id: number
        }
        Update: {
          amount_per_100?: number
          food_id?: string
          nutrient_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrient_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrient_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrient"
            referencedColumns: ["id"]
          },
        ]
      }
      food_portion: {
        Row: {
          food_id: string
          grams: number
          id: string
          label_es: string
        }
        Insert: {
          food_id: string
          grams: number
          id?: string
          label_es: string
        }
        Update: {
          food_id?: string
          grams?: number
          id?: string
          label_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_portion_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
        ]
      }
      goal: {
        Row: {
          active: boolean
          created_at: string
          id: string
          start_date: string
          target_bmi: number | null
          target_weight_kg: number
          user_id: string
          weekly_rate_kg: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          start_date?: string
          target_bmi?: number | null
          target_weight_kg: number
          user_id: string
          weekly_rate_kg: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          start_date?: string
          target_bmi?: number | null
          target_weight_kg?: number
          user_id?: string
          weekly_rate_kg?: number
        }
        Relationships: []
      }
      meal_entry: {
        Row: {
          created_at: string
          eaten_at: string
          id: string
          meal_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eaten_at: string
          id?: string
          meal_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          eaten_at?: string
          id?: string
          meal_type?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_item: {
        Row: {
          carb_g: number
          created_at: string
          fat_g: number
          food_id: string
          grams_resolved: number
          id: string
          kcal: number
          meal_entry_id: string
          portion_id: string | null
          protein_g: number
          quantity: number
          unit: string
        }
        Insert: {
          carb_g?: number
          created_at?: string
          fat_g?: number
          food_id: string
          grams_resolved: number
          id?: string
          kcal: number
          meal_entry_id: string
          portion_id?: string | null
          protein_g?: number
          quantity: number
          unit: string
        }
        Update: {
          carb_g?: number
          created_at?: string
          fat_g?: number
          food_id?: string
          grams_resolved?: number
          id?: string
          kcal?: number
          meal_entry_id?: string
          portion_id?: string | null
          protein_g?: number
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_item_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_item_meal_entry_id_fkey"
            columns: ["meal_entry_id"]
            isOneToOne: false
            referencedRelation: "meal_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_item_portion_fk"
            columns: ["portion_id", "food_id"]
            isOneToOne: false
            referencedRelation: "food_portion"
            referencedColumns: ["id", "food_id"]
          },
        ]
      }
      nutrient: {
        Row: {
          code: string
          id: number
          name_es: string
          sort_order: number
          unit: string
        }
        Insert: {
          code: string
          id?: never
          name_es: string
          sort_order?: number
          unit: string
        }
        Update: {
          code?: string
          id?: never
          name_es?: string
          sort_order?: number
          unit?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          birth_date: string
          bmr_formula: string
          bmr_measured_kcal: number | null
          created_at: string
          display_name: string | null
          height_cm: number
          sedentary_steps_threshold: number
          sex: string
          stride_m: number | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          bmr_formula?: string
          bmr_measured_kcal?: number | null
          created_at?: string
          display_name?: string | null
          height_cm: number
          sedentary_steps_threshold?: number
          sex: string
          stride_m?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          bmr_formula?: string
          bmr_measured_kcal?: number | null
          created_at?: string
          display_name?: string | null
          height_cm?: number
          sedentary_steps_threshold?: number
          sex?: string
          stride_m?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe: {
        Row: {
          cooked_weight_g: number
          created_at: string
          food_id: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          cooked_weight_g: number
          created_at?: string
          food_id: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          cooked_weight_g?: number
          created_at?: string
          food_id?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: true
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredient: {
        Row: {
          food_id: string
          grams: number
          recipe_id: string
        }
        Insert: {
          food_id: string
          grams: number
          recipe_id: string
        }
        Update: {
          food_id?: string
          grams?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredient_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredient_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_session: {
        Row: {
          activity_type_id: number
          created_at: string
          distance_km: number | null
          duration_min: number
          hr_avg: number | null
          hr_max: number | null
          hr_min: number | null
          id: string
          kcal_hr: number | null
          kcal_met: number | null
          kcal_method: string
          kcal_net: number
          kcal_selected: number
          machine_kcal: number | null
          notes: string | null
          rpe: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          activity_type_id: number
          created_at?: string
          distance_km?: number | null
          duration_min: number
          hr_avg?: number | null
          hr_max?: number | null
          hr_min?: number | null
          id?: string
          kcal_hr?: number | null
          kcal_met?: number | null
          kcal_method: string
          kcal_net: number
          kcal_selected: number
          machine_kcal?: number | null
          notes?: string | null
          rpe?: number | null
          started_at: string
          user_id: string
        }
        Update: {
          activity_type_id?: number
          created_at?: string
          distance_km?: number | null
          duration_min?: number
          hr_avg?: number | null
          hr_max?: number | null
          hr_min?: number | null
          id?: string
          kcal_hr?: number | null
          kcal_met?: number | null
          kcal_method?: string
          kcal_net?: number
          kcal_selected?: number
          machine_kcal?: number | null
          notes?: string | null
          rpe?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_type"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template: {
        Row: {
          activity_type_id: number
          created_at: string
          duration_min: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          activity_type_id: number
          created_at?: string
          duration_min: number
          id?: string
          name: string
          user_id: string
        }
        Update: {
          activity_type_id?: number
          created_at?: string
          duration_min?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_type"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      f_unaccent: { Args: { value: string }; Returns: string }
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
    Enums: {},
  },
} as const
