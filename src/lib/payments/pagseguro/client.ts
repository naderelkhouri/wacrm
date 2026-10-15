// ============================================================
// PagBank / PagSeguro API v4 HTTP Client
// ============================================================

import type {
  CreatePixOrderParams,
  PagSeguroOrderResponse,
  PagSeguroEnv,
} from './types';

export class PagSeguroApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PagSeguroApiError';
  }
}

export class PagSeguroClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    const env: PagSeguroEnv =
      (process.env.PAGSEGURO_ENV as PagSeguroEnv) || 'production';
    this.baseUrl =
      env === 'sandbox'
        ? 'https://sandbox.api.pagseguro.com'
        : 'https://api.pagseguro.com';
    this.token = process.env.PAGSEGURO_TOKEN || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.token && this.token.trim().length > 0);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Create a Pix payment order for a subscription plan.
   * Generates QR Code and Pix "Copia e Cola" string.
   */
  public async createPixOrder(
    params: CreatePixOrderParams
  ): Promise<PagSeguroOrderResponse> {
    if (!this.isConfigured()) {
      throw new PagSeguroApiError(
        'PAGSEGURO_TOKEN não configurado no ambiente do servidor.',
        500
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://wcloudapi.dev';
    const notificationUrl = `${appUrl.replace(/\/+$/, '')}/api/webhooks/pagseguro`;

    // Reference ID carries accountId and planId for fast webhook resolution
    const referenceId = `sub_${params.accountId}_${params.planId}_${Date.now()}`;

    const expMinutes = params.expirationMinutes || 60; // 1 hour default
    const expirationDate = new Date(
      Date.now() + expMinutes * 60 * 1000
    ).toISOString();

    const cleanTaxId = params.customer.taxId?.replace(/\D/g, '') || undefined;
    const cleanPhone = params.customer.phone?.replace(/\D/g, '') || undefined;

    // Parse Brazilian phone if available (e.g. 11988887777 -> area: 11, number: 988887777)
    let phonesPayload: Array<{ country: string; area: string; number: string; type: 'MOBILE' }> | undefined;
    if (cleanPhone && cleanPhone.length >= 10) {
      const area = cleanPhone.slice(0, 2);
      const number = cleanPhone.slice(2);
      phonesPayload = [
        {
          country: '55',
          area,
          number,
          type: 'MOBILE',
        },
      ];
    }

    const payload = {
      reference_id: referenceId,
      customer: {
        name: params.customer.name,
        email: params.customer.email,
        ...(cleanTaxId ? { tax_id: cleanTaxId } : {}),
        ...(phonesPayload ? { phones: phonesPayload } : {}),
      },
      items: [
        {
          reference_id: `plan_${params.planId}`,
          name: `Assinatura WACRM - Plano ${params.planName}`,
          quantity: 1,
          unit_amount: params.amountCents,
        },
      ],
      qr_codes: [
        {
          amount: {
            value: params.amountCents,
          },
          expiration_date: expirationDate,
        },
      ],
      notification_urls: [notificationUrl],
    };

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorJson: unknown;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = errorText;
      }
      throw new PagSeguroApiError(
        `Falha ao criar cobrança Pix no PagBank (${res.status}): ${JSON.stringify(errorJson)}`,
        res.status,
        errorJson
      );
    }

    return (await res.json()) as PagSeguroOrderResponse;
  }

  /**
   * Fetch an existing order by ID from PagBank.
   */
  public async getOrder(orderId: string): Promise<PagSeguroOrderResponse> {
    if (!this.isConfigured()) {
      throw new PagSeguroApiError(
        'PAGSEGURO_TOKEN não configurado.',
        500
      );
    }

    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new PagSeguroApiError(
        `Falha ao consultar pedido no PagBank (${res.status}): ${errorText}`,
        res.status
      );
    }

    return (await res.json()) as PagSeguroOrderResponse;
  }
}

export const pagseguroClient = new PagSeguroClient();
