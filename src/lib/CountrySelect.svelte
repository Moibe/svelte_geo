<script>
  export let value = '+1';

  const countries = [
    { abbr: 'US', code: '+1' },
    { abbr: 'MX', code: '+52' },
    { abbr: 'CA', code: '+1' },
    { abbr: 'UK', code: '+44' },
    { abbr: 'ES', code: '+34' },
    { abbr: 'FR', code: '+33' },
    { abbr: 'DE', code: '+49' },
    { abbr: 'IT', code: '+39' },
    { abbr: 'BR', code: '+55' },
    { abbr: 'AR', code: '+54' },
    { abbr: 'CO', code: '+57' },
    { abbr: 'PE', code: '+51' },
    { abbr: 'CL', code: '+56' },
    { abbr: 'JP', code: '+81' },
    { abbr: 'AU', code: '+61' },
    { abbr: 'ZA', code: '+27' },
  ];

  // Mapeo inverso: código telefónico -> código ISO
  const phoneToIso = {
    '+1': 'US', '+52': 'MX', '+44': 'GB', '+34': 'ES', '+33': 'FR', '+49': 'DE',
    '+39': 'IT', '+55': 'BR', '+54': 'AR', '+57': 'CO', '+51': 'PE', '+56': 'CL',
    '+81': 'JP', '+61': 'AU', '+27': 'ZA', '+376': 'AD', '+971': 'AE', '+93': 'AF',
    '+355': 'AL', '+374': 'AM', '+244': 'AO', '+297': 'AW', '+994': 'AZ',
    '+387': 'BA', '+880': 'BD', '+32': 'BE', '+226': 'BF', '+359': 'BG',
    '+973': 'BH', '+257': 'BI', '+229': 'BJ', '+673': 'BN', '+591': 'BO',
    '+975': 'BT', '+267': 'BW', '+375': 'BY', '+501': 'BZ', '+243': 'CD',
    '+236': 'CF', '+242': 'CG', '+41': 'CH', '+225': 'CI', '+682': 'CK',
    '+237': 'CM', '+86': 'CN', '+506': 'CR', '+53': 'CU', '+238': 'CV',
    '+599': 'CW', '+357': 'CY', '+420': 'CZ', '+253': 'DJ', '+45': 'DK',
    '+213': 'DZ', '+593': 'EC', '+372': 'EE', '+20': 'EG', '+291': 'ER',
    '+251': 'ET', '+358': 'FI', '+679': 'FJ', '+500': 'FK', '+691': 'FM',
    '+298': 'FO', '+241': 'GA', '+995': 'GE', '+594': 'GF', '+233': 'GH',
    '+350': 'GI', '+299': 'GL', '+220': 'GM', '+224': 'GN', '+590': 'GP',
    '+240': 'GQ', '+30': 'GR', '+502': 'GT', '+245': 'GW', '+592': 'GY',
    '+852': 'HK', '+504': 'HN', '+385': 'HR', '+509': 'HT', '+36': 'HU',
    '+62': 'ID', '+353': 'IE', '+972': 'IL', '+91': 'IN', '+964': 'IQ',
    '+98': 'IR', '+354': 'IS', '+962': 'JO', '+254': 'KE', '+996': 'KG',
    '+855': 'KH', '+686': 'KI', '+269': 'KM', '+850': 'KP', '+82': 'KR',
    '+965': 'KW', '+7': 'RU', '+856': 'LA', '+961': 'LB', '+423': 'LI',
    '+94': 'LK', '+231': 'LR', '+266': 'LS', '+370': 'LT', '+352': 'LU',
    '+371': 'LV', '+218': 'LY', '+212': 'MA', '+377': 'MC', '+373': 'MD',
    '+382': 'ME', '+261': 'MG', '+692': 'MH', '+389': 'MK', '+223': 'ML',
    '+95': 'MM', '+976': 'MN', '+853': 'MO', '+596': 'MQ', '+222': 'MR',
    '+356': 'MT', '+230': 'MU', '+960': 'MV', '+265': 'MW', '+60': 'MY',
    '+258': 'MZ', '+264': 'NA', '+687': 'NC', '+227': 'NE', '+672': 'NF',
    '+234': 'NG', '+505': 'NI', '+31': 'NL', '+47': 'NO', '+977': 'NP',
    '+674': 'NR', '+683': 'NU', '+64': 'NZ', '+968': 'OM', '+507': 'PA',
    '+689': 'PF', '+675': 'PG', '+63': 'PH', '+92': 'PK', '+48': 'PL',
    '+508': 'PM', '+970': 'PS', '+351': 'PT', '+680': 'PW', '+595': 'PY',
    '+974': 'QA', '+262': 'RE', '+40': 'RO', '+381': 'RS', '+250': 'RW',
    '+966': 'SA', '+677': 'SB', '+248': 'SC', '+249': 'SD', '+46': 'SE',
    '+65': 'SG', '+290': 'SH', '+386': 'SI', '+421': 'SK', '+232': 'SL',
    '+378': 'SM', '+221': 'SN', '+252': 'SO', '+597': 'SR', '+211': 'SS',
    '+239': 'ST', '+503': 'SV', '+963': 'SY', '+268': 'SZ', '+235': 'TD',
    '+228': 'TG', '+66': 'TH', '+992': 'TJ', '+690': 'TK', '+670': 'TL',
    '+993': 'TM', '+216': 'TN', '+676': 'TO', '+90': 'TR', '+688': 'TV',
    '+886': 'TW', '+255': 'TZ', '+380': 'UA', '+256': 'UG', '+598': 'UY',
    '+998': 'UZ', '+379': 'VA', '+58': 'VE', '+84': 'VN', '+678': 'VU',
    '+681': 'WF', '+685': 'WS', '+383': 'XK', '+967': 'YE', '+260': 'ZM',
    '+263': 'ZW',
  };

  // Obtener abreviatura ISO desde código telefónico
  function getIsoFromPhone(phoneCode) {
    return phoneToIso[phoneCode] || 'US'; // Fallback a US si no se encuentra
  }

  // Verificar si el valor actual está en la lista
  $: isValueInList = countries.some(c => c.code === value);
  
  // Lista final: si el valor no está, agregarlo al inicio con su ISO correcto
  $: displayCountries = isValueInList 
    ? countries 
    : [{ abbr: getIsoFromPhone(value), code: value }, ...countries];
</script>

<select class="country-select" bind:value>
  {#each displayCountries as country}
    <option value={country.code}>{country.abbr} {country.code}</option>
  {/each}
</select>

<style>
  .country-select {
    padding: 1rem 1.5rem;
    font-size: 1.5rem;
    border: 2px solid #90caf9;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.95);
    color: #0052cc;
    transition: all 0.3s ease;
    box-sizing: border-box;
    min-width: 120px;
    cursor: pointer;
    font-weight: bold;
  }

  .country-select option {
    color: #0052cc;
    font-weight: bold;
    font-size: 1.5rem;
  }

  .country-select:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 12px rgba(74, 144, 226, 0.4);
  }
</style>
