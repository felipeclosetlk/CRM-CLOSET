import { Timestamp } from 'firebase/firestore';

export interface Cliente {
  id?: string;
  nome: string;
  telefone: string;
  tamanho?: string;
  cidade?: string;
  comprou?: string;
  queria_comprar?: string;
  canal: string;
  comprou_status: 'sim' | 'nao';
  status_crm?: 'LEAD FRIO' | 'LEAD MORNO' | 'LEAD QUENTE' | 'EM ATENDIMENTO' | 'FINALIZADO';
  posicao?: number;
  created_at: Timestamp;
  uid: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
