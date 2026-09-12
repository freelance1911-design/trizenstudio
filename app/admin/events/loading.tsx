export default function EventsLoading() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      <header className="border-b border-[#17212b]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="h-10 w-12 animate-pulse rounded-xl bg-[#176875]/10" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-[#17212b]/10" />
        </div>
      </header>
      <section className="mx-auto max-w-[1400px] px-6 py-14 lg:px-10 lg:py-20">
        <div className="flex items-end justify-between border-b border-[#17212b]/10 pb-10">
          <div>
            <div className="h-3 w-32 animate-pulse rounded-full bg-[#176875]/15" />
            <div className="mt-6 h-20 w-80 max-w-[70vw] animate-pulse rounded-2xl bg-[#17212b]/10" />
            <div className="mt-5 h-4 w-96 max-w-[80vw] animate-pulse rounded-full bg-[#17212b]/10" />
          </div>
          <div className="hidden h-12 w-32 animate-pulse rounded-full bg-[#e5763f]/20 md:block" />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 pt-10 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index}>
              <div className="aspect-[4/3] animate-pulse rounded-2xl bg-[#176875]/10" />
              <div className="mt-5 h-7 w-48 animate-pulse rounded-full bg-[#17212b]/10" />
              <div className="mt-4 h-3 w-32 animate-pulse rounded-full bg-[#17212b]/10" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
