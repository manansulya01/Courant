import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title:"Courant — confident speakers", description:"Your personal AI speaking tutor." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}