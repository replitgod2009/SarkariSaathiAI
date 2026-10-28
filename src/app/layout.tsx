import type {Metadata} from 'next';
import {Noto_Sans,Noto_Sans_Devanagari} from 'next/font/google';
import './globals.css';
const latin=Noto_Sans({subsets:['latin'],variable:'--font-latin',display:'swap'});
const devanagari=Noto_Sans_Devanagari({subsets:['devanagari'],variable:'--font-devanagari',display:'swap'});
export const metadata:Metadata={title:'SarkariSaathi AI — Understand. Verify. Act.',description:'Understand government documents in English and Hindi, with source quotes, automated checks, and clear next steps.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={`${latin.variable} ${devanagari.variable}`}>{children}</body></html>}
