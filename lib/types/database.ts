export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          github_id: number | null;
          github_handle: string;
          display_name: string | null;
          avatar_url: string | null;
          primary_persona: string | null;
          secondary_personas: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          github_id?: number | null;
          github_handle: string;
          display_name?: string | null;
          avatar_url?: string | null;
          primary_persona?: string | null;
          secondary_personas?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          github_id?: number | null;
          github_handle?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          primary_persona?: string | null;
          secondary_personas?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_stats: {
        Row: {
          user_id: string;
          date: string;
          tokens_total: number;
          tokens_by_model: Json;
          sessions: number;
          deep_work_minutes: number;
          machines: string[];
          projects_touched: Json;
          ships: Json;
          source_synced_at: string | null;
        };
        Insert: {
          user_id: string;
          date: string;
          tokens_total?: number;
          tokens_by_model?: Json;
          sessions?: number;
          deep_work_minutes?: number;
          machines?: string[];
          projects_touched?: Json;
          ships?: Json;
          source_synced_at?: string | null;
        };
        Update: {
          user_id?: string;
          date?: string;
          tokens_total?: number;
          tokens_by_model?: Json;
          sessions?: number;
          deep_work_minutes?: number;
          machines?: string[];
          projects_touched?: Json;
          ships?: Json;
          source_synced_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
