import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const zad = localFont({
    src: [
        { path: "../public/fonts/GraphikArabic-Light.ttf", weight: "300", style: "normal" },
        { path: "../public/fonts/GraphikArabic-Regular.ttf", weight: "400", style: "normal" },
        { path: "../public/fonts/GraphikArabic-Medium.ttf", weight: "500", style: "normal" },
        { path: "../public/fonts/GraphikArabic-Semibold.ttf", weight: "600", style: "normal" },
        { path: "../public/fonts/GraphikArabic-Bold.ttf", weight: "700", style: "normal" },
    ],
    variable: "--font-zad",
});

export const metadata: Metadata = {
    title: { default: "لوحة زاد", template: "%s | لوحة زاد" },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    icons: { icon: "/brand/zad-icon-primary.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ar" dir="rtl" className={zad.variable}>
            <body className="min-h-screen font-sans">{children}</body>
        </html>
    );
}
