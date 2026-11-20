// ============================================================
// BunkerPay API v1 TypeScript Definitions
// Gateway: bunkerpay.io (Public API)
// ============================================================

export type BunkerPayPaymentStatus =
  | 'pending'
  | 'review'
  | 'approved'
  | 'not_approved'
  | 'rejected'
  | 'blocked'
  | 'refunded'
  | 'withdrawal_processing'
  | 'paid'
  | 'receipt_sent';

export interface BunkerPayCreatePaymentInput {
  /** Valor em BRL (mínimo 5.00) */
  amount: number;
  /** E-mail do cliente */
  email?: string;
  /** Observação livre (usada para vincular a referência da assinatura: sub_{accountId}_{planId}_{timestamp}) */
  observation?: string;
  /** URL de webhook para notificações */
  webhookUrl?: string;
}

export interface BunkerPayPaymentResponse {
  id: string;
  status: BunkerPayPaymentStatus;
  amount: number;
  feeAmount?: number | null;
  liquidValue?: number | null;
  storeId: string;
  createdAt: string;
  observation?: string | null;
  email: string;
  qrCodeUrl?: string | null;
  qrCopyPaste?: string | null;
  qrCodeBase64?: string | null;
  isPublic?: boolean;
}

export interface BunkerPayBalanceResponse {
  availableBalance: number;
  postedBalance: number;
  pendingWithdrawal: number;
  blockedBalance: number;
  medDebt: number;
  receivedPendingApprovalBalance: number;
  currency: 'BRL';
  updatedAt: string;
}

export interface BunkerPayWebhookEvent {
  event: 'payment.created' | 'payment.status_changed';
  id?: string;
  payment: BunkerPayPaymentResponse;
  previousStatus?: BunkerPayPaymentStatus;
}
