export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          github_id: number | null;
          auth_id: string | null;
          github_handle: string;
          display_name: string | null;
          avatar_url: string | null;
          primary_persona: string | null;
          secondary_personas: string[];
          ingest_token: string | null;
          private_project_names: boolean;
          timezone: string;
          created_at: string;
          updated_at: string;
          team: 'claude_code' | 'codex' | null;
          team_switched_at: string | null;
        };
        Insert: {
          id?: string;
          github_id?: number | null;
          auth_id?: string | null;
          github_handle: string;
          display_name?: string | null;
          avatar_url?: string | null;
          primary_persona?: string | null;
          secondary_personas?: string[];
          ingest_token?: string | null;
          private_project_names?: boolean;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
          team?: 'claude_code' | 'codex' | null;
          team_switched_at?: string | null;
        };
        Update: {
          id?: string;
          github_id?: number | null;
          auth_id?: string | null;
          github_handle?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          primary_persona?: string | null;
          secondary_personas?: string[];
          ingest_token?: string | null;
          private_project_names?: boolean;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
          team?: 'claude_code' | 'codex' | null;
          team_switched_at?: string | null;
        };
        Relationships: [];
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
          hourly_tokens: Json;
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
          hourly_tokens?: Json;
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
          hourly_tokens?: Json;
          source_synced_at?: string | null;
        };
        Relationships: [];
      };
      machine_daily_stats: {
        Row: {
          user_id: string;
          date: string;
          machine: string;
          tokens_total: number;
          tokens_by_model: Json;
          sessions: number;
          deep_work_minutes: number;
          projects_touched: Json;
          ships: Json;
          hourly_tokens: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          machine: string;
          tokens_total?: number;
          tokens_by_model?: Json;
          sessions?: number;
          deep_work_minutes?: number;
          projects_touched?: Json;
          ships?: Json;
          hourly_tokens?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          date?: string;
          machine?: string;
          tokens_total?: number;
          tokens_by_model?: Json;
          sessions?: number;
          deep_work_minutes?: number;
          projects_touched?: Json;
          ships?: Json;
          hourly_tokens?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          color: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          color?: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          color?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          user_id: string;
          friend_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          friend_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          friend_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      signup_events: {
        Row: {
          id: string;
          created_at: string | null;
          event_type: string;
          auth_user_id: string | null;
          user_id: string | null;
          github_handle: string | null;
          user_agent: string | null;
          referer: string | null;
          error_message: string | null;
          is_new_user: boolean | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string | null;
          event_type: string;
          auth_user_id?: string | null;
          user_id?: string | null;
          github_handle?: string | null;
          user_agent?: string | null;
          referer?: string | null;
          error_message?: string | null;
          is_new_user?: boolean | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string | null;
          event_type?: string;
          auth_user_id?: string | null;
          user_id?: string | null;
          github_handle?: string | null;
          user_agent?: string | null;
          referer?: string | null;
          error_message?: string | null;
          is_new_user?: boolean | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      dim_anchor: {
        Row: {
          dim: string;
          anchor: number;
          k: number;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          dim: string;
          anchor: number;
          k: number;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          dim?: string;
          anchor?: number;
          k?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_dim_baseline: {
        Row: {
          user_id: string;
          dim: string;
          m_hat: number;
          s_hat: number;
          n: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          dim: string;
          m_hat: number;
          s_hat: number;
          n: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          dim?: string;
          m_hat?: number;
          s_hat?: number;
          n?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_intraday_share: {
        Row: {
          user_id: string;
          dim: string;
          hour: number;
          share: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          dim: string;
          hour: number;
          share: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          dim?: string;
          hour?: number;
          share?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_private: {
        Row: {
          user_id: string;
          email: string | null;
          email_opt_in: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email?: string | null;
          email_opt_in?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string | null;
          email_opt_in?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
