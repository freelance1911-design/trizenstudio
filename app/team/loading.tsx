export default function TeamLoading() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]"><aside className="fixed inset-y-0 left-0 hidden w-[255px] border-r border-[#17212b]/10 bg-[#f7f4ee] lg:block"><div className="m-9 h-12 w-16 animate-pulse rounded-xl bg-[#176875]/10" /></aside><section className="lg:pl-[255px]"><header className="border-b border-[#17212b]/10 px-6 py-6 lg:px-10"><div className="h-3 w-36 animate-pulse rounded-full bg-[#17212b]/10" /></header><div className="mx-auto max-w-[1400px] px-6 py-14 lg:px-10"><div className="h-3 w-24 animate-pulse rounded-full bg-[#e5763f]/20" /><div className="mt-6 h-28 w-full max-w-2xl animate-pulse rounded-2xl bg-[#17212b]/10" /><div className="mt-10 divide-y divide-[#17212b]/10 border-y border-[#17212b]/10">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-pulse bg-[#176875]/5" />)}</div></div></section></main>
  );
}
