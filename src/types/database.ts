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
 * Estado verificado: migrations 0001 a 0014 aplicadas e verificadas contra o banco
 * real. A **0015** (view `crm_merchant_origin_status`) está aplicada e
 * verificada apenas no cluster local — 23 checagens `OK`, reconstruído do zero.
 * A forma abaixo veio de lá. **Confirmar contra o painel quando a migration for
 * aplicada:** se a verificação de lá divergir, este tipo é que está errado. `source_ref` entra nas quatro entidades pela 0007; `companies` pela
 * 0012; `crm_company_relationships` pela 0013; `crm_demand_origins` e
 * `crm_accreditation_demands` pela 0014.
 *
 * As quatro tabelas abaixo foram transcritas da saída de
 * `information_schema.columns` contra o schema reconstruído do zero — não do
 * modelo em prosa. `companies` NÃO tem `source_ref` (D-004: o CRM é a fonte de
 * verdade do cadastro) nem coluna de responsável (D-006: o responsável vive no
 * relacionamento).
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
      companies: {
        Row: {
          id: string
          legal_name: string
          trade_name: string | null
          cnpj: string | null
          legacy_customer_code: string | null
          parent_company_id: string | null
          relationship_start_date: string | null
          status: Database['public']['Enums']['entity_status']
          situacao_cadastral: string | null
          cnae_principal: string | null
          atividade: string | null
          cep: string | null
          logradouro: string | null
          numero: string | null
          complemento: string | null
          bairro: string | null
          municipio: string | null
          uf: string | null
          telefone: string | null
          cnpj_lookup_at: string | null
          cnpj_lookup_source: string | null
          latitude: number | null
          longitude: number | null
          inactivated_at: string | null
          inactivated_by: string | null
          inactivation_reason: string | null
          reactivation_reason: string | null
          created_at: string
          updated_at: string
          is_merchant: boolean
          is_client_company: boolean
        }
        Insert: {
          id?: string
          legal_name: string
          trade_name?: string | null
          cnpj?: string | null
          legacy_customer_code?: string | null
          parent_company_id?: string | null
          relationship_start_date?: string | null
          status?: Database['public']['Enums']['entity_status']
          situacao_cadastral?: string | null
          cnae_principal?: string | null
          atividade?: string | null
          cep?: string | null
          logradouro?: string | null
          numero?: string | null
          complemento?: string | null
          bairro?: string | null
          municipio?: string | null
          uf?: string | null
          telefone?: string | null
          cnpj_lookup_at?: string | null
          cnpj_lookup_source?: string | null
          latitude?: number | null
          longitude?: number | null
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          reactivation_reason?: string | null
          created_at?: string
          updated_at?: string
          is_merchant?: boolean
          is_client_company?: boolean
        }
        Update: {
          id?: string
          legal_name?: string
          trade_name?: string | null
          cnpj?: string | null
          legacy_customer_code?: string | null
          parent_company_id?: string | null
          relationship_start_date?: string | null
          status?: Database['public']['Enums']['entity_status']
          situacao_cadastral?: string | null
          cnae_principal?: string | null
          atividade?: string | null
          cep?: string | null
          logradouro?: string | null
          numero?: string | null
          complemento?: string | null
          bairro?: string | null
          municipio?: string | null
          uf?: string | null
          telefone?: string | null
          cnpj_lookup_at?: string | null
          cnpj_lookup_source?: string | null
          latitude?: number | null
          longitude?: number | null
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          reactivation_reason?: string | null
          created_at?: string
          updated_at?: string
          is_merchant?: boolean
          is_client_company?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'companies_parent_company_id_fkey'
            columns: ['parent_company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      crm_company_relationships: {
        Row: {
          id: string
          company_id: string
          relationship_type: Database['public']['Enums']['crm_relationship_type']
          origin: Database['public']['Enums']['crm_opportunity_origin']
          responsible_seller_id: string | null
          team_id: string | null
          relationship_started_at: string | null
          ended_at: string | null
          ended_by: string | null
          end_reason: string | null
          status: Database['public']['Enums']['entity_status']
          inactivated_at: string | null
          inactivated_by: string | null
          inactivation_reason: string | null
          reactivation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          relationship_type?: Database['public']['Enums']['crm_relationship_type']
          origin?: Database['public']['Enums']['crm_opportunity_origin']
          responsible_seller_id?: string | null
          team_id?: string | null
          relationship_started_at?: string | null
          ended_at?: string | null
          ended_by?: string | null
          end_reason?: string | null
          status?: Database['public']['Enums']['entity_status']
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          reactivation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          relationship_type?: Database['public']['Enums']['crm_relationship_type']
          origin?: Database['public']['Enums']['crm_opportunity_origin']
          responsible_seller_id?: string | null
          team_id?: string | null
          relationship_started_at?: string | null
          ended_at?: string | null
          ended_by?: string | null
          end_reason?: string | null
          status?: Database['public']['Enums']['entity_status']
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          reactivation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crm_company_relationships_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_company_relationships_responsible_seller_id_fkey'
            columns: ['responsible_seller_id']
            isOneToOne: false
            referencedRelation: 'sellers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_company_relationships_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      crm_demand_origins: {
        Row: {
          id: string
          match_key: string
          name: string
          requires_client_company: boolean
          status: Database['public']['Enums']['entity_status']
          inactivated_at: string | null
          inactivated_by: string | null
          inactivation_reason: string | null
          reactivation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          match_key: string
          name: string
          requires_client_company?: boolean
          status?: Database['public']['Enums']['entity_status']
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          reactivation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          match_key?: string
          name?: string
          requires_client_company?: boolean
          status?: Database['public']['Enums']['entity_status']
          inactivated_at?: string | null
          inactivated_by?: string | null
          inactivation_reason?: string | null
          reactivation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_accreditation_demands: {
        Row: {
          id: string
          merchant_company_id: string
          origin_id: string
          client_company_id: string | null
          requested_at: string | null
          responsible_seller_id: string | null
          team_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          merchant_company_id: string
          origin_id: string
          client_company_id?: string | null
          requested_at?: string | null
          responsible_seller_id?: string | null
          team_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          merchant_company_id?: string
          origin_id?: string
          client_company_id?: string | null
          requested_at?: string | null
          responsible_seller_id?: string | null
          team_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crm_accreditation_demands_merchant_company_id_fkey'
            columns: ['merchant_company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_accreditation_demands_origin_id_fkey'
            columns: ['origin_id']
            isOneToOne: false
            referencedRelation: 'crm_demand_origins'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_accreditation_demands_client_company_id_fkey'
            columns: ['client_company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      /**
       * Projeção de leitura da 0015. `security_invoker = true` — o recorte é o
       * das tabelas de baixo, não o do dono (D-045).
       *
       * Só `Row`: view com join não é atualizável no Postgres, e é bom que não
       * seja — escrita passa pelas tabelas, onde as policies e as triggers
       * estão. Não declarar `Insert`/`Update` faz o typecheck recusar antes de
       * o banco recusar.
       */
      crm_merchant_origin_status: {
        Row: {
          relationship_id: string
          company_id: string
          responsible_seller_id: string | null
          team_id: string | null
          relationship_type: Database['public']['Enums']['crm_relationship_type']
          relationship_started_at: string | null
          ended_at: string | null
          relationship_status: Database['public']['Enums']['entity_status']
          legal_name: string
          trade_name: string | null
          cnpj: string | null
          municipio: string | null
          uf: string | null
          company_status: Database['public']['Enums']['entity_status']
          company_created_at: string
          tem_origem: boolean
        }
        Relationships: []
      }
    }
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
      crm_relationship_type: 'prospect' | 'base_vegas'
      crm_opportunity_origin:
        | 'novo_prospect'
        | 'base_vegas'
        | 'importacao'
        | 'indicacao'
        | 'outro'
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

export type CompanyRow = Database['public']['Tables']['companies']['Row']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type RelationshipRow =
  Database['public']['Tables']['crm_company_relationships']['Row']
export type RelationshipInsert =
  Database['public']['Tables']['crm_company_relationships']['Insert']
export type DemandOriginRow =
  Database['public']['Tables']['crm_demand_origins']['Row']
export type DemandRow =
  Database['public']['Tables']['crm_accreditation_demands']['Row']
export type DemandInsert =
  Database['public']['Tables']['crm_accreditation_demands']['Insert']
export type MerchantOriginStatusRow =
  Database['public']['Views']['crm_merchant_origin_status']['Row']
export type RelationshipType =
  Database['public']['Enums']['crm_relationship_type']
export type OpportunityOrigin =
  Database['public']['Enums']['crm_opportunity_origin']
