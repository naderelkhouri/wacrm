// ============================================================
// BunkerPay API HTTP Client
// Host: https://public-api.bunkerpay.io
// API Docs: https://admin.bunkerpay.io/api-docs/public-api
// ============================================================

import type {
  BunkerPayCreatePaymentInput,
  BunkerPayPaymentResponse,
  BunkerPayBalanceResponse,
} from './types';

export class BunkerPayApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'BunkerPayApiError';
    this.status = status;
    this.details = details;
  }
}

export class BunkerPayClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = (process.env.BUNKERPAY_API_URL || 'https://public-api.bunkerpay.io').replace(/\/+$/, '');
    this.token = process.env.BUNKERPAY_TOKEN || '';
  }

  private getHeaders(): HeadersInit {
    const token = process.env.BUNKERPAY_TOKEN || this.token;
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Cria um pagamento dinâmico Pix via BunkerPay
   * POST /api-public/payments
   */
  public async createPayment(input: BunkerPayCreatePaymentInput): Promise<BunkerPayPaymentResponse> {
    const token = process.env.BUNKERPAY_TOKEN || this.token;
    if (!token) {
      throw new BunkerPayApiError('BUNKERPAY_TOKEN não configurado no ambiente do servidor.', 500);
    }

    if (input.amount < 5) {
      throw new BunkerPayApiError('O valor mínimo permitido para geração de pagamento é R$ 5,00.', 400);
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wcloudapi.dev';
    const webhookUrl = input.webhookUrl || `${appUrl.replace(/\/+$/, '')}/api/webhooks/bunkerpay`;

    const payload = {
      amount: input.amount,
      ...(input.email ? { email: input.email } : {}),
      ...(input.observation ? { observation: input.observation } : {}),
      webhookUrl,
    };

    const res = await fetch(`${this.baseUrl}/api-public/payments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }

      const errorMessage =
        typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
          ? Array.isArray((errorBody as { message: unknown }).message)
            ? (errorBody as { message: string[] }).message.join(', ')
            : String((errorBody as { message: unknown }).message)
          : `Erro na API BunkerPay (${res.status})`;

      throw new BunkerPayApiError(errorMessage, res.status, errorBody);
    }

    return (await res.json()) as BunkerPayPaymentResponse;
  }

  /**
   * Busca um pagamento por ID
   * GET /api-public/payments/{id}
   */
  public async getPayment(paymentId: string): Promise<BunkerPayPaymentResponse> {
    const token = process.env.BUNKERPAY_TOKEN || this.token;
    if (!token) {
      throw new BunkerPayApiError('BUNKERPAY_TOKEN não configurado.', 500);
    }

    const res = await fetch(`${this.baseUrl}/api-public/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new BunkerPayApiError(`Erro ao buscar pagamento BunkerPay (${res.status})`, res.status, errorBody);
    }

    return (await res.json()) as BunkerPayPaymentResponse;
  }

  /**
   * Consulta o saldo da loja
   * GET /api-public/balance
   */
  public async getBalance(): Promise<BunkerPayBalanceResponse> {
    const token = process.env.BUNKERPAY_TOKEN || this.token;
    if (!token) {
      throw new BunkerPayApiError('BUNKERPAY_TOKEN não configurado.', 500);
    }

    const res = await fetch(`${this.baseUrl}/api-public/balance`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new BunkerPayApiError(`Erro ao consultar saldo BunkerPay (${res.status})`, res.status, errorBody);
    }

    return (await res.json()) as BunkerPayBalanceResponse;
  }
}

export const bunkerPayClient = new BunkerPayClient();
