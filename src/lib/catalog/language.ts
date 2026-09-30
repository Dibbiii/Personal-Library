/** Codici lingua: i provider usano ISO 639-2 (Open Library) o 639-1 (Google); il DB conserva 639-1 dove possibile. */

const ISO2_FROM_ISO3: Record<string, string> = {
	ita: 'it',
	eng: 'en',
	fre: 'fr',
	fra: 'fr',
	ger: 'de',
	deu: 'de',
	spa: 'es',
	por: 'pt',
	lat: 'la',
	dut: 'nl',
	nld: 'nl',
	rus: 'ru',
	pol: 'pl',
	swe: 'sv',
	dan: 'da',
	nor: 'no',
	fin: 'fi',
	gre: 'el',
	ell: 'el',
	jpn: 'ja',
	chi: 'zh',
	zho: 'zh',
	cat: 'ca',
	tur: 'tr',
	heb: 'he',
	ara: 'ar',
	rum: 'ro',
	ron: 'ro',
	hun: 'hu',
	cze: 'cs',
	ces: 'cs'
};

const ISO3_FROM_ISO2: Record<string, string> = Object.fromEntries(
	Object.entries(ISO2_FROM_ISO3)
		.filter(([iso3]) => !['fra', 'deu', 'nld', 'ell', 'zho', 'ron', 'ces'].includes(iso3))
		.map(([iso3, iso2]) => [iso2, iso3])
);

export const LANGUAGE_LABELS: Record<string, string> = {
	it: 'Italiano',
	en: 'Inglese',
	fr: 'Francese',
	de: 'Tedesco',
	es: 'Spagnolo',
	pt: 'Portoghese',
	la: 'Latino',
	nl: 'Olandese',
	ru: 'Russo',
	pl: 'Polacco',
	sv: 'Svedese',
	ja: 'Giapponese',
	zh: 'Cinese'
};

/** `ita`, `it`, `it-IT`, `Italian` -> `it`. Sconosciuti: stringa minuscola troncata a 16. */
export function toIso2(value: string | null | undefined): string | null {
	if (!value) return null;
	const code = value
		.trim()
		.toLowerCase()
		.replace(/^\/languages\//, '');
	if (!code) return null;
	if (/^[a-z]{2}([-_][a-z0-9]+)?$/.test(code)) return code.slice(0, 2);
	if (ISO2_FROM_ISO3[code]) return ISO2_FROM_ISO3[code] as string;
	return code.slice(0, 16);
}

/** `it` -> `ita` (per il filtro `language:` di Open Library). */
export function toIso3(value: string | null | undefined): string | null {
	const iso2 = toIso2(value);
	if (!iso2) return null;
	return ISO3_FROM_ISO2[iso2] ?? null;
}

export function languageLabel(code: string | null | undefined): string | null {
	const iso2 = toIso2(code);
	if (!iso2) return null;
	return LANGUAGE_LABELS[iso2] ?? iso2.toUpperCase();
}
