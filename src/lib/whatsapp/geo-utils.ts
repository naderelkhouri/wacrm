// ============================================================
// WhatsApp Geo-Location & DDD Parser
//
// Automatically detects Country, State (UF), and City from phone numbers
// to ensure regional compliance and optimal proxy routing.
// ============================================================

export interface DetectedGeoLocation {
  country: string;
  countryName: string;
  state?: string;
  city?: string;
  isBrazil: boolean;
}

export const BRAZIL_DDD_MAP: Record<string, { state: string; city: string }> = {
  // São Paulo
  '11': { state: 'SP', city: 'São Paulo' },
  '12': { state: 'SP', city: 'São José dos Campos' },
  '13': { state: 'SP', city: 'Santos' },
  '14': { state: 'SP', city: 'Bauru' },
  '15': { state: 'SP', city: 'Sorocaba' },
  '16': { state: 'SP', city: 'Ribeirão Preto' },
  '17': { state: 'SP', city: 'São José do Rio Preto' },
  '18': { state: 'SP', city: 'Presidente Prudente' },
  '19': { state: 'SP', city: 'Campinas' },

  // Rio de Janeiro
  '21': { state: 'RJ', city: 'Rio de Janeiro' },
  '22': { state: 'RJ', city: 'Campos dos Goytacazes' },
  '24': { state: 'RJ', city: 'Petrópolis' },

  // Espírito Santo
  '27': { state: 'ES', city: 'Vitória' },
  '28': { state: 'ES', city: 'Cachoeiro de Itapemirim' },

  // Minas Gerais
  '31': { state: 'MG', city: 'Belo Horizonte' },
  '32': { state: 'MG', city: 'Juiz de Fora' },
  '33': { state: 'MG', city: 'Governador Valadares' },
  '34': { state: 'MG', city: 'Uberlândia' },
  '35': { state: 'MG', city: 'Poços de Caldas' },
  '37': { state: 'MG', city: 'Divinópolis' },
  '38': { state: 'MG', city: 'Montes Claros' },

  // Paraná
  '41': { state: 'PR', city: 'Curitiba' },
  '42': { state: 'PR', city: 'Ponta Grossa' },
  '43': { state: 'PR', city: 'Londrina' },
  '44': { state: 'PR', city: 'Maringá' },
  '45': { state: 'PR', city: 'Foz do Iguaçu' },
  '46': { state: 'PR', city: 'Francisco Beltrão' },

  // Santa Catarina
  '47': { state: 'SC', city: 'Joinville' },
  '48': { state: 'SC', city: 'Florianópolis' },
  '49': { state: 'SC', city: 'Chapecó' },

  // Rio Grande do Sul
  '51': { state: 'RS', city: 'Porto Alegre' },
  '53': { state: 'RS', city: 'Pelotas' },
  '54': { state: 'RS', city: 'Caxias do Sul' },
  '55': { state: 'RS', city: 'Santa Maria' },

  // Centro-Oeste
  '61': { state: 'DF', city: 'Brasília' },
  '62': { state: 'GO', city: 'Goiânia' },
  '64': { state: 'GO', city: 'Rio Verde' },
  '65': { state: 'MT', city: 'Cuiabá' },
  '66': { state: 'MT', city: 'Rondonópolis' },
  '67': { state: 'MS', city: 'Campo Grande' },
  '68': { state: 'AC', city: 'Rio Branco' },
  '69': { state: 'RO', city: 'Porto Velho' },

  // Bahia & Sergipe
  '71': { state: 'BA', city: 'Salvador' },
  '73': { state: 'BA', city: 'Ilhéus' },
  '74': { state: 'BA', city: 'Juazeiro' },
  '75': { state: 'BA', city: 'Feira de Santana' },
  '77': { state: 'BA', city: 'Vitória da Conquista' },
  '79': { state: 'SE', city: 'Aracaju' },

  // Nordeste (PE, AL, PB, RN, CE, PI, MA)
  '81': { state: 'PE', city: 'Recife' },
  '82': { state: 'AL', city: 'Maceió' },
  '83': { state: 'PB', city: 'João Pessoa' },
  '84': { state: 'RN', city: 'Natal' },
  '85': { state: 'CE', city: 'Fortaleza' },
  '86': { state: 'PI', city: 'Teresina' },
  '87': { state: 'PE', city: 'Petrolina' },
  '88': { state: 'CE', city: 'Juazeiro do Norte' },
  '89': { state: 'PI', city: 'Picos' },
  '98': { state: 'MA', city: 'São Luís' },
  '99': { state: 'MA', city: 'Imperatriz' },

  // Norte (PA, AP, AM, RR, TO)
  '91': { state: 'PA', city: 'Belém' },
  '92': { state: 'AM', city: 'Manaus' },
  '93': { state: 'PA', city: 'Santarém' },
  '94': { state: 'PA', city: 'Marabá' },
  '95': { state: 'RR', city: 'Boa Vista' },
  '96': { state: 'AP', city: 'Macapá' },
  '97': { state: 'AM', city: 'Coari' },
};

export const SUPPORTED_COUNTRIES = [
  { code: 'BR', name: 'Brasil', ddi: '55', flag: '🇧🇷' },
  { code: 'US', name: 'Estados Unidos', ddi: '1', flag: '🇺🇸' },
  { code: 'PT', name: 'Portugal', ddi: '351', flag: '🇵🇹' },
  { code: 'ES', name: 'Espanha', ddi: '34', flag: '🇪🇸' },
  { code: 'MX', name: 'México', ddi: '52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', ddi: '54', flag: '🇦🇷' },
  { code: 'CO', name: 'Colômbia', ddi: '57', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', ddi: '56', flag: '🇨🇱' },
  { code: 'GB', name: 'Reino Unido', ddi: '44', flag: '🇬🇧' },
];

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

/**
 * Detects Country, State, and City from an arbitrary phone string.
 */
export function detectGeoFromPhone(rawPhone: string): DetectedGeoLocation {
  const trimmed = rawPhone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return { country: 'BR', countryName: 'Brasil', isBrazil: true };
  }

  // If number starts with explicit '+' and it is NOT Brazil (+55), check international DDIs first
  if (hasPlus && !digits.startsWith('55')) {
    // Sort by DDI length descending so longer DDIs match first (e.g., +351 before +3)
    const sortedCountries = [...SUPPORTED_COUNTRIES].sort((a, b) => b.ddi.length - a.ddi.length);
    for (const c of sortedCountries) {
      if (c.code !== 'BR' && digits.startsWith(c.ddi)) {
        return {
          country: c.code,
          countryName: c.name,
          isBrazil: false,
        };
      }
    }
  }

  // Check Brazil (starts with 55)
  if (digits.startsWith('55') && digits.length >= 4) {
    const ddd = digits.substring(2, 4);
    const mapped = BRAZIL_DDD_MAP[ddd];
    return {
      country: 'BR',
      countryName: 'Brasil',
      state: mapped?.state || 'SP',
      city: mapped?.city || 'São Paulo',
      isBrazil: true,
    };
  }

  // Check if it's a national Brazilian number with DDD (length 10 or 11, like 11999998888)
  if (!hasPlus && (digits.length === 10 || digits.length === 11) && !digits.startsWith('0')) {
    const ddd = digits.substring(0, 2);
    if (BRAZIL_DDD_MAP[ddd]) {
      const mapped = BRAZIL_DDD_MAP[ddd];
      return {
        country: 'BR',
        countryName: 'Brasil',
        state: mapped.state,
        city: mapped.city,
        isBrazil: true,
      };
    }
  }

  // Check international DDIs
  for (const c of SUPPORTED_COUNTRIES) {
    if (c.code !== 'BR' && digits.startsWith(c.ddi)) {
      return {
        country: c.code,
        countryName: c.name,
        isBrazil: false,
      };
    }
  }

  // Default fallback
  return {
    country: 'BR',
    countryName: 'Brasil',
    state: 'SP',
    city: 'São Paulo',
    isBrazil: true,
  };
}
