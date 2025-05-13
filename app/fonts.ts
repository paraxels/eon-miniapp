import localFont from 'next/font/local';

// Register your custom font
export const customFont = localFont({
  src: '../public/fonts/EnglishTowne.ttf', // Update this with your actual font filename
  variable: '--font-custom',
  display: 'swap',
});
