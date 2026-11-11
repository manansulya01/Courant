import "./globals.css";
import type { Metadata } from "next";
import OfflineSupport from "@/components/OfflineSupport";

export const metadata: Metadata = {
  title: {default:"Courant — Find your own voice",template:"%s · Courant"},
  description:"A thoughtful place to practise the conversations that matter. Find your words, try again, and build confidence at your own pace.",
  applicationName:"Courant",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"Courant",statusBarStyle:"default"},
  robots:{index:true,follow:true},
  themeColor:"#315b4c",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><OfflineSupport />{children}</body></html>;
}
