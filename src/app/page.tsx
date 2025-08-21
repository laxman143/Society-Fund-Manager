
"use client";
import dynamic from "next/dynamic";

const FundManager = dynamic(() => import("./FundManager"), { ssr: false });

export default function Home() {
  return <FundManager />;
}
