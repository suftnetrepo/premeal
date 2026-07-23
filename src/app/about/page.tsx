export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 w-full">
      <p className="text-xs font-semibold tracking-widest text-orange-600 mb-3">ABOUT</p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-900 mb-6">
        Food, on your schedule.
      </h1>
      <div className="flex flex-col gap-4 text-stone-600">
        <p>
          Most delivery apps optimize for speed right now — but not every order needs to arrive in
          20 minutes. Sometimes you know exactly when you want to eat: after a meeting ends, when
          guests arrive, or just at a normal dinner time you already planned around.
        </p>
        <p>
          Pre-Meal is built around that instead. You order ahead, pick a delivery window, and the
          restaurant confirms within 30 minutes — so they can cook for a real, scheduled order
          rather than rushing one out the door.
        </p>
        <p>
          Restaurants keep the full delivery fee they charge, pay a flat commission only on food
          they actually sell, and get paid automatically once an order is delivered.
        </p>
      </div>
    </main>
  );
}
