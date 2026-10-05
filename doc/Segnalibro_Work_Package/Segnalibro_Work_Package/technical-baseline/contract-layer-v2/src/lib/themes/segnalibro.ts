import type { ThemeDefinition } from '../contracts/themes';

/**
 * UNICO posto (insieme agli altri file theme) in cui sono ammessi colori
 * letterali dell'interfaccia.
 *
 * I componenti devono usare solo CSS variables semantiche.
 */
export const segnalibroTheme: ThemeDefinition = {
  schemaVersion: 1,
  id: 'segnalibro',
  name: 'Segnalibro',

  colors: {
    background: '#FAF1EE',
    surface: '#F2DCDB',
    surfaceElevated: '#FFF8F5',

    textPrimary: '#340A0E',
    textSecondary: '#6F2B34',
    textMuted: '#6F625F',

    primary: '#570F1D',
    onPrimary: '#FFFFFF',
    primarySubtle: '#F2DCDB',

    secondary: '#6F2B34',
    onSecondary: '#FFFFFF',

    accent: '#F2AEBC',
    onAccent: '#340A0E',

    border: '#B79F9D',
    divider: '#81815D',

    icon: '#111506',
    iconMuted: '#81815D',

    shadow: '#111506',
    overlay: '#340A0E',

    success: '#476C4F',
    onSuccess: '#FFFFFF',

    warning: '#9A6500',
    onWarning: '#FFFFFF',

    danger: '#9B2D30',
    onDanger: '#FFFFFF',

    info: '#315E7A',
    onInfo: '#FFFFFF',
  },

  genres: {
    classics: {
      base: '#8B5E3C',
      light: '#EADCCB',
      dark: '#4A2E1A',
      onBase: '#FFFFFF',
      onLight: '#340A0E',
    },

    'mythology-epic-retelling': {
      base: '#C4694A',
      light: '#F5DDD2',
      dark: '#6B301D',
      onBase: '#FFFFFF',
      onLight: '#340A0E',
    },

    'dystopia-scifi': {
      base: '#E8843A',
      light: '#FBE3CC',
      dark: '#7A3E0E',
      onBase: '#340A0E',
      onLight: '#340A0E',
    },

    'thriller-mystery': {
      base: '#E0B62B',
      light: '#FAF0C4',
      dark: '#6B5410',
      onBase: '#340A0E',
      onLight: '#340A0E',
    },

    'fantasy-magical-gothic': {
      base: '#7E5BA8',
      light: '#E6DCF0',
      dark: '#3F2A5C',
      onBase: '#FFFFFF',
      onLight: '#340A0E',
    },

    'romance-ya-na': {
      base: '#E0708F',
      light: '#FADCE4',
      dark: '#7A2444',
      onBase: '#340A0E',
      onLight: '#340A0E',
    },

    'contemporary-historical': {
      base: '#6FB0DC',
      light: '#DCEEF8',
      dark: '#23506E',
      onBase: '#340A0E',
      onLight: '#340A0E',
    },
  },
};
