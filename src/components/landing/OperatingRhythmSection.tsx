const operatingSteps = [
  {
    number: '01',
    title: 'Capture every person',
    description:
      'Add someone manually, import a CSV, accept an event registration, or receive them through an integration.',
  },
  {
    number: '02',
    title: 'Build a complete picture',
    description:
      'Combine profile details, tags, ministry roles, household relationships, notes, and activity history.',
  },
  {
    number: '03',
    title: 'Turn insight into action',
    description:
      'Create smart lists and move people into workflows with clear ownership and a visible next step.',
  },
  {
    number: '04',
    title: 'Keep every system in sync',
    description:
      'Use tenant-scoped API keys and webhooks to connect the wider HarvestGen Church OS safely.',
  },
];

export function OperatingRhythmSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            From first contact to meaningful care
          </div>
          <h2 className="text-balance text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            A clear operating rhythm for your team.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            The system connects data collection, understanding, action, and
            integration in one continuous flow.
          </p>
        </div>

        <div className="relative mt-16 grid gap-4 lg:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-8 hidden border-t border-dashed border-emerald-300 lg:block" />
          {operatingSteps.map((step) => (
            <article
              key={step.number}
              className="relative rounded-3xl border border-slate-200 bg-white p-6"
            >
              <div className="relative mb-8 grid h-16 w-16 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700 shadow-[0_0_0_8px_#fbfcf9]">
                {step.number}
              </div>
              <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
