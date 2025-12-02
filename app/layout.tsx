import { Inter } from "next/font/google";
import "./globals.css";
import I18nProvider from "./components/I18nProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "SitterApp",
  description: "Childcare coordination made easy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
