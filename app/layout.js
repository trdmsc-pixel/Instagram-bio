import "./globals.css";

export const metadata = {
  title: "sham-decoded | Bio",
  description: "Curated products and gear from @sham-decoded.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
