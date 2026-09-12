export default function PhotosLoading() {
  return <main className="min-h-screen bg-[#f7f4ee] px-6 py-12 lg:px-10"><div className="mx-auto max-w-[1500px]"><div className="h-10 w-12 animate-pulse rounded-xl bg-[#176875]/10" /><div className="mt-16 h-20 w-96 max-w-full animate-pulse rounded-2xl bg-[#17212b]/10" /><div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-[#176875]/10" />)}</div></div></main>;
}
