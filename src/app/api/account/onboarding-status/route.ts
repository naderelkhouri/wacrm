import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  actionLabel: string;
  category: 'essential' | 'ai' | 'productivity' | 'collaboration';
  tip: string;
}

export interface OnboardingStatusResponse {
  completedCount: number;
  totalCount: number;
  percentage: number;
  allCompleted: boolean;
  steps: OnboardingStep[];
}

export async function GET() {
  try {
    const { supabase, accountId, userId, profile } = (await getCurrentAccount()) as unknown as {
      supabase: any;
      accountId: string;
      userId: string;
      profile?: any;
    };

    // Parallel fetch of all setup criteria
    const [
      whatsappRes,
      profileRes,
      aiRes,
      quickRepliesRes,
      templatesRes,
      contactsRes,
      membersRes,
      invitationsRes,
    ] = await Promise.allSettled([
      // 1. WhatsApp Connection
      supabase
        .from('whatsapp_config')
        .select('phone_number_id, status')
        .eq('account_id', accountId)
        .maybeSingle(),

      // 2. Profile and Account
      supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', userId)
        .maybeSingle(),

      // 3. AI Agent Config
      supabase
        .from('ai_configs')
        .select('provider, is_active')
        .eq('account_id', accountId)
        .maybeSingle(),

      // 4. Quick Replies
      supabase
        .from('quick_replies')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),

      // 4b. Message Templates
      supabase
        .from('message_templates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),

      // 5. Contacts count
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),

      // 6. Team Members (>1 member)
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),

      // 6b. Pending Invitations
      supabase
        .from('account_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .is('accepted_at', null),
    ]);

    // Parse WhatsApp Status
    const whatsappData =
      whatsappRes.status === 'fulfilled' ? whatsappRes.value.data : null;
    const whatsappCompleted = !!(
      whatsappData?.phone_number_id && whatsappData?.phone_number_id.length > 0
    );

    // Parse Profile Status (User filled name)
    const profileData =
      profileRes.status === 'fulfilled' ? profileRes.value.data : null;
    const profileCompleted = !!(
      profileData?.full_name && profileData.full_name.trim().length > 1
    );

    // Parse AI Config Status
    const aiData = aiRes.status === 'fulfilled' ? aiRes.value.data : null;
    const aiCompleted = !!(aiData?.provider || aiData?.is_active);

    // Parse Quick Replies & Templates
    const quickRepliesCount =
      quickRepliesRes.status === 'fulfilled'
        ? quickRepliesRes.value.count ?? 0
        : 0;
    const templatesCount =
      templatesRes.status === 'fulfilled'
        ? templatesRes.value.count ?? 0
        : 0;
    const templatesCompleted = quickRepliesCount > 0 || templatesCount > 0;

    // Parse Contacts
    const contactsCount =
      contactsRes.status === 'fulfilled' ? contactsRes.value.count ?? 0 : 0;
    const contactsCompleted = contactsCount > 0;

    // Parse Team / Members
    const membersCount =
      membersRes.status === 'fulfilled' ? membersRes.value.count ?? 0 : 0;
    const invitationsCount =
      invitationsRes.status === 'fulfilled'
        ? invitationsRes.value.count ?? 0
        : 0;
    const teamCompleted = membersCount > 1 || invitationsCount > 0;

    const steps: OnboardingStep[] = [
      {
        id: 'whatsapp',
        title: 'Conectar WhatsApp Cloud API',
        description:
          'Conecte seu número oficial do WhatsApp Business para iniciar o envio e recebimento de mensagens.',
        completed: whatsappCompleted,
        href: '/settings?tab=whatsapp',
        actionLabel: 'Conectar WhatsApp',
        category: 'essential',
        tip: 'Você precisará do Phone Number ID e do Access Token gerados no painel do Meta for Developers.',
      },
      {
        id: 'profile',
        title: 'Completar Perfil e Organização',
        description:
          'Personalize seu nome completo, avatar e defina a moeda padrão para negociações.',
        completed: profileCompleted,
        href: '/settings?tab=profile',
        actionLabel: 'Editar Perfil',
        category: 'essential',
        tip: 'Seu nome será exibido para a equipe nos atendimentos do Inbox e nos relatórios de atividade.',
      },
      {
        id: 'ai',
        title: 'Configurar Agentes de IA & Especialistas',
        description:
          'Ative inteligência artificial generativa e configure assistentes com respostas inteligentes no Inbox.',
        completed: aiCompleted,
        href: '/agents',
        actionLabel: 'Configurar IA',
        category: 'ai',
        tip: 'Conecte sua chave da OpenAI ou Anthropic para permitir respostas sugeridas e auto-atendimento 24/7.',
      },
      {
        id: 'templates',
        title: 'Criar Respostas Rápidas',
        description:
          'Cadastre atalhos com mensagens frequentes para acelerar o atendimento diário da sua equipe.',
        completed: templatesCompleted,
        href: '/settings?tab=quick-replies',
        actionLabel: 'Criar Respostas',
        category: 'productivity',
        tip: 'Use o atalho "/" no Inbox para enviar mensagens padronizadas em segundos.',
      },
      {
        id: 'contacts',
        title: 'Cadastrar Primeiro Contato',
        description:
          'Adicione leads manualmente ou faça a importação em lote da sua lista via arquivo CSV.',
        completed: contactsCompleted,
        href: '/contacts',
        actionLabel: 'Adicionar Contatos',
        category: 'productivity',
        tip: 'Ao importar contatos, você pode associar tags personalizadas para segmentar suas campanhas de transmissão.',
      },
      {
        id: 'team',
        title: 'Convidar Membros da Equipe',
        description:
          'Traga seus atendentes, vendedores e gerentes para colaborar em tempo real com controle de permissões.',
        completed: teamCompleted,
        href: '/settings?tab=members',
        actionLabel: 'Convidar Membros',
        category: 'collaboration',
        tip: 'Você pode definir papéis de Administrador, Agente ou Visualizador para cada colaborador.',
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const totalCount = steps.length;
    const percentage = Math.round((completedCount / totalCount) * 100);
    const allCompleted = completedCount === totalCount;

    return NextResponse.json({
      completedCount,
      totalCount,
      percentage,
      allCompleted,
      steps,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
