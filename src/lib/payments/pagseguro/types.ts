// ============================================================
// PagBank / PagSeguro API v4 TypeScript Definitions
// ============================================================

export type PagSeguroEnv = 'sandbox' | 'production';

export interface PagSeguroPhone {
  country: string;
  area: string;
  number: string;
  type?: 'MOBILE' | 'BUSINESS' | 'HOME';
}

export interface PagSeguroCustomer {
  name: string;
  email: string;
  tax_id?: string; // CPF (11 digits) or CNPJ (14 digits)
  phones?: PagSeguroPhone[];
}

export interface PagSeguroOrderItem {
  reference_id: string;
  name: string;
  quantity: number;
  unit_amount: number; // in cents (e.g. 14700)
}

export interface PagSeguroQrCode {
  id?: string;
  amount: {
    value: number; // in cents
  };
  expiration_date?: string; // ISO 8601
  text?: string;            // Pix Copia e Cola payload
  links?: Array<{
    rel: string;
    href: string;
    media: string;
    type: string;
  }>;
}

export interface CreatePixOrderParams {
  accountId: string;
  planId: string;
  planName: string;
  amountCents: number;
  customer: {
    name: string;
    email: string;
    taxId?: string;
    phone?: string;
  };
  expirationMinutes?: number;
}

export interface PagSeguroOrderResponse {
  id: string;
  reference_id: string;
  created_at: string;
  customer?: {
    name: string;
    email: string;
    tax_id?: string;
  };
  items?: PagSeguroOrderItem[];
  qr_codes?: PagSeguroQrCode[];
  charges?: Array<{
    id: string;
    reference_id: string;
    status: 'PAID' | 'WAITING' | 'AUTHORIZED' | 'DECLINED' | 'CANCELED';
    created_at: string;
    paid_at?: string;
    amount: {
      value: number;
      currency: string;
      summary?: {
        total: number;
        paid: number;
        refunded: number;
      };
    };
    payment_method: {
      type: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
    };
  }>;
  notification_urls?: string[];
  links?: Array<{
    rel: string;
    href: string;
    media: string;
    type: string;
  }>;
}

export interface PagSeguroWebhookEvent {
  id?: string;
  reference_id?: string;
  created_at?: string;
  charges?: Array<{
    id: string;
    reference_id: string;
    status: 'PAID' | 'WAITING' | 'AUTHORIZED' | 'DECLINED' | 'CANCELED';
    paid_at?: string;
    amount: {
      value: number;
      currency: string;
    };
    payment_method?: {
      type: string;
    };
  }>;
  order?: {
    id: string;
    reference_id: string;
  };
  notification_urls?: string[];
}
