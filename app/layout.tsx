import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: {default:"Courant — Find your own voice",template:"%s · Courant"},
  description:"A thoughtful place to practise the conversations that matter. Find your words, try again, and build confidence at your own pace.",
  applicationName:"Courant",
  robots:{index:true,follow:true},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
