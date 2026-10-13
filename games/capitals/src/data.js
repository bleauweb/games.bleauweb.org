// Countries, capitals, regions and ISO codes (the flag is the ISO code as an emoji).
const R = { EU: 'Europe', AS: 'Asia', AF: 'Africa', NA: 'North America', SA: 'South America', OC: 'Oceania' };

const rows = `
AF|Afghanistan|Kabul|AS
AL|Albania|Tirana|EU
DZ|Algeria|Algiers|AF
AO|Angola|Luanda|AF
AR|Argentina|Buenos Aires|SA
AM|Armenia|Yerevan|AS
AU|Australia|Canberra|OC
AT|Austria|Vienna|EU
AZ|Azerbaijan|Baku|AS
BS|Bahamas|Nassau|NA
BD|Bangladesh|Dhaka|AS
BY|Belarus|Minsk|EU
BE|Belgium|Brussels|EU
BZ|Belize|Belmopan|NA
BJ|Benin|Porto-Novo|AF
BT|Bhutan|Thimphu|AS
BO|Bolivia|Sucre|SA
BA|Bosnia and Herzegovina|Sarajevo|EU
BW|Botswana|Gaborone|AF
BR|Brazil|Brasília|SA
BG|Bulgaria|Sofia|EU
KH|Cambodia|Phnom Penh|AS
CM|Cameroon|Yaoundé|AF
CA|Canada|Ottawa|NA
CL|Chile|Santiago|SA
CN|China|Beijing|AS
CO|Colombia|Bogotá|SA
CR|Costa Rica|San José|NA
HR|Croatia|Zagreb|EU
CU|Cuba|Havana|NA
CY|Cyprus|Nicosia|EU
CZ|Czechia|Prague|EU
DK|Denmark|Copenhagen|EU
DO|Dominican Republic|Santo Domingo|NA
EC|Ecuador|Quito|SA
EG|Egypt|Cairo|AF
SV|El Salvador|San Salvador|NA
EE|Estonia|Tallinn|EU
ET|Ethiopia|Addis Ababa|AF
FJ|Fiji|Suva|OC
FI|Finland|Helsinki|EU
FR|France|Paris|EU
GE|Georgia|Tbilisi|AS
DE|Germany|Berlin|EU
GH|Ghana|Accra|AF
GR|Greece|Athens|EU
GT|Guatemala|Guatemala City|NA
HT|Haiti|Port-au-Prince|NA
HN|Honduras|Tegucigalpa|NA
HU|Hungary|Budapest|EU
IS|Iceland|Reykjavík|EU
IN|India|New Delhi|AS
ID|Indonesia|Jakarta|AS
IR|Iran|Tehran|AS
IQ|Iraq|Baghdad|AS
IE|Ireland|Dublin|EU
IL|Israel|Jerusalem|AS
IT|Italy|Rome|EU
JM|Jamaica|Kingston|NA
JP|Japan|Tokyo|AS
JO|Jordan|Amman|AS
KZ|Kazakhstan|Astana|AS
KE|Kenya|Nairobi|AF
KW|Kuwait|Kuwait City|AS
KG|Kyrgyzstan|Bishkek|AS
LA|Laos|Vientiane|AS
LV|Latvia|Riga|EU
LB|Lebanon|Beirut|AS
LY|Libya|Tripoli|AF
LT|Lithuania|Vilnius|EU
LU|Luxembourg|Luxembourg|EU
MG|Madagascar|Antananarivo|AF
MW|Malawi|Lilongwe|AF
MY|Malaysia|Kuala Lumpur|AS
ML|Mali|Bamako|AF
MT|Malta|Valletta|EU
MX|Mexico|Mexico City|NA
MD|Moldova|Chișinău|EU
MN|Mongolia|Ulaanbaatar|AS
ME|Montenegro|Podgorica|EU
MA|Morocco|Rabat|AF
MZ|Mozambique|Maputo|AF
MM|Myanmar|Naypyidaw|AS
NA|Namibia|Windhoek|AF
NP|Nepal|Kathmandu|AS
NL|Netherlands|Amsterdam|EU
NZ|New Zealand|Wellington|OC
NI|Nicaragua|Managua|NA
NE|Niger|Niamey|AF
NG|Nigeria|Abuja|AF
KP|North Korea|Pyongyang|AS
MK|North Macedonia|Skopje|EU
NO|Norway|Oslo|EU
OM|Oman|Muscat|AS
PK|Pakistan|Islamabad|AS
PA|Panama|Panama City|NA
PG|Papua New Guinea|Port Moresby|OC
PY|Paraguay|Asunción|SA
PE|Peru|Lima|SA
PH|Philippines|Manila|AS
PL|Poland|Warsaw|EU
PT|Portugal|Lisbon|EU
QA|Qatar|Doha|AS
RO|Romania|Bucharest|EU
RU|Russia|Moscow|EU
RW|Rwanda|Kigali|AF
SA|Saudi Arabia|Riyadh|AS
SN|Senegal|Dakar|AF
RS|Serbia|Belgrade|EU
SG|Singapore|Singapore|AS
SK|Slovakia|Bratislava|EU
SI|Slovenia|Ljubljana|EU
SO|Somalia|Mogadishu|AF
ZA|South Africa|Pretoria|AF
KR|South Korea|Seoul|AS
ES|Spain|Madrid|EU
LK|Sri Lanka|Sri Jayawardenepura Kotte|AS
SD|Sudan|Khartoum|AF
SE|Sweden|Stockholm|EU
CH|Switzerland|Bern|EU
SY|Syria|Damascus|AS
TW|Taiwan|Taipei|AS
TJ|Tajikistan|Dushanbe|AS
TZ|Tanzania|Dodoma|AF
TH|Thailand|Bangkok|AS
TN|Tunisia|Tunis|AF
TR|Turkey|Ankara|AS
TM|Turkmenistan|Ashgabat|AS
UG|Uganda|Kampala|AF
UA|Ukraine|Kyiv|EU
AE|United Arab Emirates|Abu Dhabi|AS
GB|United Kingdom|London|EU
US|United States|Washington, D.C.|NA
UY|Uruguay|Montevideo|SA
UZ|Uzbekistan|Tashkent|AS
VE|Venezuela|Caracas|SA
VN|Vietnam|Hanoi|AS
YE|Yemen|Sanaa|AS
ZM|Zambia|Lusaka|AF
ZW|Zimbabwe|Harare|AF
`;

export const COUNTRIES = rows
  .trim()
  .split('\n')
  .map((line) => {
    const [code, name, capital, region] = line.split('|');
    return { code, name, capital, region: R[region] };
  });

export const REGIONS = Object.values(R);

export function flag(code) {
  return String.fromCodePoint(...code.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const LEVELS = [
  { id: 'europe', name: 'Europe', region: 'Europe' },
  { id: 'americas', name: 'The Americas', region: ['North America', 'South America'] },
  { id: 'asia', name: 'Asia', region: 'Asia' },
  { id: 'africa', name: 'Africa', region: 'Africa' },
  { id: 'oceania', name: 'Oceania + islands', region: ['Oceania'] },
  { id: 'world', name: 'The whole world', region: null },
];

export function countriesFor(level) {
  if (!level.region) return COUNTRIES;
  const regions = Array.isArray(level.region) ? level.region : [level.region];
  return COUNTRIES.filter((c) => regions.includes(c.region));
}
