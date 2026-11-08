// ============================================================
// Stripe Billing & Checkout Client
//
// Provides international subscription management in USD / EUR
// alongside PagBank (PagSeguro) for Brazilian Real (BRL).
// ============================================================

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

export const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_placeholder_key', {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  typescript: true,
});

export const STRIPE_PLAN_PRICES: Record<
  string,
  { usdCents: number; eurCents: number; name: string }
> = {
  starter: {
    usdCents: 2900, // $29.00 / month
    eurCents: 2700, // €27.00 / month
    name: 'WCloudAPI Starter',
  },
  pro: {
    usdCents: 5900, // $59.00 / month
    eurCents: 5500, // €55.00 / month
    name: 'WCloudAPI Professional',
  },
  enterprise: {
    usdCents: 14900, // $149.00 / month
    eurCents: 13900, // €139.00 / month
    name: 'WCloudAPI Enterprise',
  },
};

export interface CreateStripeCheckoutSessionParams {
  accountId: string;
  userId: string;
  planId: string;
  currency?: 'usd' | 'eur';
  customerEmail?: string;
  customerName?: string;
  origin: string;
}

export async function createStripeCheckoutSession(
  params: CreateStripeCheckoutSessionParams
): Promise<{ url: string; sessionId: string }> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY não configurada no ambiente. Adicione a chave no arquivo de variáveis de ambiente.'
    );
  }

  const { accountId, userId, planId, currency = 'usd', customerEmail, customerName, origin } = params;

  const planInfo = STRIPE_PLAN_PRICES[planId.toLowerCase()] || STRIPE_PLAN_PRICES.starter;
  const unitAmount = currency === 'eur' ? planInfo.eurCents : planInfo.usdCents;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: accountId,
    customer_email: customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: planInfo.name,
            description: `Assinatura mensal ${planInfo.name} com acesso completo ao WCloudAPI.`,
          },
          unit_amount: unitAmount,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      accountId,
      userId,
      planId,
    },
    subscription_data: {
      metadata: {
        accountId,
        userId,
        planId,
      },
    },
    success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard?checkout=canceled`,
  });

  if (!session.url) {
    throw new Error('Falha ao gerar URL da sessão de Checkout do Stripe.');
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}
