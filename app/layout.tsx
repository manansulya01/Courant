import "./globals.css";
import type { Metadata, Viewport } from "next";
import OfflineSupport from "@/components/OfflineSupport";

export const metadata: Metadata = {
  title: {default:"Courant — Find your own voice",template:"%s · Courant"},
  description:"A thoughtful place to practise the conversations that matter. Find your words, try again, and build confidence at your own pace.",
  applicationName:"Courant",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/icon.svg"},
  appleWebApp:{capable:true,title:"Courant",statusBarStyle:"default"},
  robots:{index:true,follow:true},
};

export const viewport: Viewport = {
  themeColor:"#315b4c",
  width:"device-width",
  initialScale:1,
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><OfflineSupport />{children}</body></html>;
}
