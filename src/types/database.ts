/**
 * Tipos do banco — schema `public`.
 *
 * ORIGEM DESTE ARQUIVO. Normalmente ele é gerado por `npm run db:types`. Aqui
 * ele é mantido à mão, porque o projeto aplica migrations pelo SQL Editor
 * (D-031) e o gerador oficial exige CLI vinculado ao projeto.
 *
 * O que substitui a geração automática: cada migration vem com um script em
 * `supabase/checks/` que lê o catálogo do Postgres e compara coluna a coluna
 * com o modelo — nome, tipo, nulidade, default, e "nenhuma coluna a mais". A
 * forma abaixo foi escrita a partir da saída desses scripts contra o banco
 * real, não a partir do modelo em prosa.
 *
 * Estado verificado: migrations 0001 a 0007 aplicadas e verificadas contra o banco
 * real. `source_ref` entra nas quatro entidades pela 0007.
 *
 * REGRA AO MEXER: este arquivo só muda depois de uma migration aplicada E
 * verificada, refletindo a saída do script. Nunca "adiantar" uma coluna que o
 * banco ainda não tem — o tipo passaria a mentir, e o typecheck confirmaria a
 * mentira.
 *
 * A forma segue a do gerador (`Row`/`Insert`/`Update`/`Relationships`) para que
 * a troca por saída de máquina, se um dia houver CLI, seja um diff pequeno.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: Database['public']['Enums']['app_role']
          is_active: boolean
          must_change_password: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: Database['public']['Enums']['app_role']
          is_active?: boolean
          must_change_password?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: Database['public']['Enums']['app_role']
          is_active?: boolean
          must_change_password?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      directors: {
        Row: {
          id: string
          full_name: string
          email: string | null
          profile_id: string | null
          status: Database['public']['Enums']['entity_status']
          active_from: string | null
          active_to: string | null
          source_ref: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          profile_id?: string | null
          status?: Database['public']['Enums']['entity_status']
          active_from?: string | null
          active_to?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          profile_id?: string | null
          status?: Database['public']['Enums']['entity_status']
          active_from?: string | null
          active_to?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'directors_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      managers: {
        Row: {
          id: string
          full_name: string
          email: string | null
          role_title: string | null
          mobile: string | null
          phone: string | null
          director_id: string | null
          profile_id: string | null
          status: Database['public']['Enums']['entity_status']
          active_from: string | null
          active_to: string | null
          source_ref: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          role_title?: string | null
          mobile?: string | null
          phone?: string | null
          director_id?: string | null
          profile_id?: string | null
          status?: Database['public']['Enums']['entity_status']
          active_from?: string | null
          active_to?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          role_title?: string | null
          mobile?: string | null
          phone?: string | null
          director_id?: string | null
          profile_id?: string | null
          status?: Database['public']['Enums']['entity_status']
          active_from?: string | null
          active_to?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'managers_director_id_fkey'
            columns: ['director_id']
            isOneToOne: false
            referencedRelation: 'directors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'managers_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          current_manager_id: string | null
          conta_na_meta: boolean
          status: Database['public']['Enums']['entity_status']
          valid_from: string | null
          valid_to: string | null
          source_ref: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          current_manager_id?: string | null
          conta_na_meta?: boolean
          status?: Database['public']['Enums']['entity_status']
          valid_from?: string | null
          valid_to?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          current_manager_id?: string | null
          conta_na_meta?: boolean
          status?: Database['public']['Enums']['entity_status']
          valid_from?: string | null
          valid_to?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teams_current_manager_id_fkey'
            columns: ['current_manager_id']
            isOneToOne: false
            referencedRelation: 'managers'
            referencedColumns: ['id']
          },
        ]
      }
      sellers: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string | null
          mobile: string | null
          team_id: string | null
          profile_id: string | null
          status: Database['public']['Enums']['entity_status']
          joined_at: string | null
          left_at: string | null
          source_ref: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone?: string | null
          mobile?: string | null
          team_id?: string | null
          profile_id?: string | null
          status?: Database['public']['Enums']['entity_status']
          joined_at?: string | null
          left_at?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          mobile?: string | null
          team_id?: string | null
          profile_id?: string | null
          status?: Database['public']['Enums']['entity_status']
          joined_at?: string | null
          left_at?: string | null
          source_ref?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sellers_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sellers_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      auth_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['app_role']
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args: { roles: Database['public']['Enums']['app_role'][] }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | 'administrador'
        | 'gestor_adm'
        | 'analista_adm'
        | 'comercial'
        | 'financeiro'
        | 'auditoria'
      entity_status: 'ativo' | 'inativo'
    }
    CompositeTypes: Record<never, never>
  }
}

/**
 * Apelidos usados pela aplicação. O gerador não os produz — ficam aqui,
 * derivados do `Database`, para que uma mudança de schema se propague sozinha
 * em vez de exigir edição em dois lugares.
 */
export type AppRole = Database['public']['Enums']['app_role']
export type EntityStatus = Database['public']['Enums']['entity_status']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type DirectorRow = Database['public']['Tables']['directors']['Row']
export type ManagerRow = Database['public']['Tables']['managers']['Row']
export type TeamRow = Database['public']['Tables']['teams']['Row']
export type SellerRow = Database['public']['Tables']['sellers']['Row']
