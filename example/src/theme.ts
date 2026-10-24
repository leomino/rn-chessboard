import { useColorScheme } from 'react-native';

const themes = {
  light: {
    background: '#f2f2f7',
    surface: '#ffffff',
    text: '#111111',
    secondaryText: '#444444',
    placeholder: '#666666',
    border: '#888888',
    error: '#b42318',
  },
  dark: {
    background: '#121212',
    surface: '#242424',
    text: '#f5f5f5',
    secondaryText: '#cccccc',
    placeholder: '#aaaaaa',
    border: '#777777',
    error: '#ffb4ab',
  },
};

export function useAppTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: themes[scheme] } as const;
}
