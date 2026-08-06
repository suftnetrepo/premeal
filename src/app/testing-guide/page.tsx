// Public, unauthenticated page for external testers — deliberately not
// linked from the main nav (see footer.tsx / nav.tsx, neither reference
// this route). Reachable only by direct link, same as /privacy and
// /terms, and follows their exact layout convention.
//
// Content is the same guide verified live against premeal.onrender.com
// (real signup/order/review/admin walkthroughs) — every finding and
// caveat from that verification pass is preserved here as-is, including
// the deliberately-omitted admin credential (see the Admin section).

const UI = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[13px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">{children}</span>
);

export default function TestingGuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 w-full">
      <p className="text-xs font-semibold tracking-widest text-orange-600 mb-3">PRE-MEAL · TESTER&apos;S GUIDE</p>
      <h1 className="text-2xl font-semibold mb-1">Everything to click, in the order to click it.</h1>
      <p className="text-sm text-stone-400 mb-8">
        Three roles, one app: Customer, Restaurant Owner, and Admin. Every step below was walked through live
        on premeal.onrender.com to confirm it&apos;s accurate — not written from memory.
      </p>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-10">
        <p className="text-sm text-green-800 font-medium mb-1">Payments are in Stripe test mode</p>
        <p className="text-sm text-green-700">
          No real charges anywhere in this guide. When a step asks for card details, use{" "}
          <span className="font-mono">4242 4242 4242 4242</span>, any future expiry date, any 3-digit CVC, and
          any postal code.
        </p>
      </div>

      <div className="flex flex-col gap-14 text-sm text-stone-600">
        {/* ============================= CUSTOMER ============================= */}
        <section>
          <p className="text-xs font-semibold tracking-wide text-orange-600 mb-1">ROLE 1 OF 3</p>
          <h2 className="text-xl font-bold text-stone-900 mb-1">Customer</h2>
          <p className="text-sm text-stone-500 mb-6">
            Browse, order, track, and review — the everyday shopper side of the app.
          </p>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Account setup</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5 mb-6">
            <li>Go to premeal.onrender.com.</li>
            <li>
              Click <UI>Sign up</UI>, top right.
            </li>
            <li>
              Leave the role toggle on <UI>I&apos;m a customer</UI> (the other option, <UI>I run a restaurant</UI>,
              is for the Restaurant Owner section below).
            </li>
            <li>
              Fill in <UI>Name</UI>, <UI>Email</UI>, and <UI>Password</UI> (minimum 8 characters).
            </li>
            <li>
              Click <UI>Sign up</UI>.
            </li>
            <li>
              You land back on the homepage, now logged in — the top-right nav changes to <UI>My orders</UI>,{" "}
              <UI>Addresses</UI>, your name, and <UI>Log out</UI>.
            </li>
            <li>
              An amber banner should appear near the top of every page: &quot;Please verify your email
              (your@email) to secure your account.&quot; — a real verification email should follow shortly.
            </li>
          </ol>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Core workflow — browse, order, track</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5 mb-4">
            <li>
              On the homepage, type a full address into the <UI>Full address</UI> box and click{" "}
              <UI>Search</UI>.
            </li>
            <li>
              Under &quot;Find your favourite,&quot; optionally narrow by cuisine chip or tick{" "}
              <UI>4+ rated</UI>, and change <UI>SORT BY</UI> (Best match / Nearest / Min order / Highest
              rated).
            </li>
            <li>Click a restaurant card.</li>
            <li>Under &quot;Choose a delivery slot,&quot; click an available date/time tile.</li>
            <li>
              Find a menu item and click its <UI>+</UI> button. If the item has required choices (e.g. a spice
              level), a panel opens — pick the required option(s), tick any optional extras, then click{" "}
              <UI>Add £X.XX</UI>.
            </li>
            <li>Repeat for anything else you want — items stack up in the &quot;Your order&quot; panel on the right.</li>
            <li>
              Under &quot;DELIVERY DETAILS,&quot; pick a saved address or select{" "}
              <UI>Use a different address</UI> and type one in.
            </li>
            <li>
              Optional: enter a promo code and click <UI>Apply</UI>.
            </li>
            <li>Enter the test card details (see the note at the top of this guide) in the payment box.</li>
            <li>
              Click <UI>Pay &amp; place order — £X.XX</UI>.
            </li>
            <li>
              You land on an order-tracking page: &quot;Waiting for restaurant to confirm&quot; with a 30-minute
              countdown. Nothing is charged yet.
            </li>
            <li>
              The restaurant now has to accept it (see the Restaurant Owner section) before this goes further —
              that part can&apos;t be tested from the customer side alone.
            </li>
            <li>
              Once a restaurant owner has accepted, dispatched, and marked it delivered, refresh this same order
              page: it now shows a delivered state with a star-rating box underneath.
            </li>
          </ol>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-1">Needs a second tester</p>
            <p className="text-sm text-amber-700">
              Steps 12–13 depend on someone testing the Restaurant Owner role at the same time to actually
              accept and deliver the order. Coordinate, or expect your order to just sit &quot;awaiting
              confirmation.&quot;
            </p>
          </div>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Secondary features</h3>
          <ul className="flex flex-col gap-3 mb-4">
            <li>
              <strong className="text-stone-900">Order history</strong> — click <UI>My orders</UI> in the nav.
              Filter pills across the top: All / Awaiting confirmation / Confirmed / Out for delivery /
              Delivered / Declined/expired. Results are paginated.
            </li>
            <li>
              <strong className="text-stone-900">Leaving a review</strong> — open any Delivered order from your
              history, click a star rating (1–5) under &quot;How was it?,&quot; optionally add a comment, click{" "}
              <UI>Submit review</UI>. Confirmed working live — this used to need checking, it&apos;s real and
              functional. Once submitted, it&apos;s locked in as &quot;Your review&quot; (no edit).
            </li>
            <li>
              <strong className="text-stone-900">Reporting a problem</strong> — on a Delivered order&apos;s
              page, <UI>Report a problem with this order</UI> opens a dispute, which holds back the
              restaurant&apos;s payout until an admin resolves it. Real and functional — use it sparingly during
              testing, since it triggers an actual moderation queue.
            </li>
            <li>
              <strong className="text-stone-900">Saved addresses</strong> — click <UI>Addresses</UI> in the
              nav. <UI>+ Add an address</UI> to save one (optional label like Home/Work, full address via
              autocomplete). <UI>Make default</UI> / <UI>Remove</UI> on any saved one.
            </li>
            <li>
              <strong className="text-stone-900">Forgot password</strong> — <UI>Forgot password?</UI> link on
              the login page sends a reset email.
            </li>
          </ul>
          <div className="bg-stone-100 border border-stone-200 rounded-xl p-4">
            <p className="text-sm text-stone-700 font-medium mb-1">Doesn&apos;t exist yet — please don&apos;t hunt for it</p>
            <p className="text-sm text-stone-600">
              There is no account-settings page on the web — nowhere to change your name or password, or delete
              your account. Account deletion exists as a backend endpoint built for the mobile app&apos;s
              Account screen specifically; there&apos;s no web equivalent. If this needs testing, it has to wait
              for the mobile app.
            </p>
          </div>
        </section>

        {/* ============================= OWNER ============================= */}
        <section>
          <p className="text-xs font-semibold tracking-wide text-orange-600 mb-1">ROLE 2 OF 3</p>
          <h2 className="text-xl font-bold text-stone-900 mb-1">Restaurant Owner</h2>
          <p className="text-sm text-stone-500 mb-6">
            Everything a restaurant needs to get listed, take orders, and get paid.
          </p>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Account setup</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5 mb-4">
            <li>Go to premeal.onrender.com/signup.</li>
            <li>
              Click <UI>I run a restaurant</UI>.
            </li>
            <li>
              Fill in your name, email, password, plus <UI>Restaurant name</UI> and <UI>Cuisine</UI>.
            </li>
            <li>
              Click <UI>Sign up</UI> — you land on /restaurant/dashboard.
            </li>
            <li>
              A &quot;Get ready to go live&quot; card shows a progress bar and checklist: Add menu items, Set up
              delivery days, Set your location, Connect payouts, Get approved by Pre-Meal, Pay the one-time
              signup fee.
            </li>
          </ol>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-1">Not visible to customers until…</p>
            <p className="text-sm text-amber-700">
              A new restaurant stays hidden from customer search until <em>both</em> every checklist item above
              is done <em>and</em> an admin approves it (see the Admin section). Expect &quot;Not live&quot; /
              &quot;Not visible to customers yet&quot; on your own dashboard until then.
            </p>
          </div>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Core workflow — running the day</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-2 mb-6">
            <li>
              <strong className="text-stone-900">Confirm orders:</strong> on the Dashboard, &quot;Needs a
              response&quot; lists anything awaiting you, with a countdown. <UI>Decline</UI> or <UI>Accept</UI>{" "}
              each one — unanswered orders auto-decline and refund after 30 minutes.
            </li>
            <li>
              <strong className="text-stone-900">Pause new orders:</strong> the <UI>Accepting new orders</UI>{" "}
              toggle sits right under your restaurant name on the Dashboard — flip it off any time you need to
              stop new orders temporarily (fully booked, closing early, etc.), flip it back on when ready.
            </li>
            <li>
              <strong className="text-stone-900">Dispatch:</strong> once accepted, an order moves to
              &quot;Confirmed — ready to dispatch&quot; — click <UI>Mark out for delivery</UI> when it&apos;s on
              its way (or <UI>Cancel</UI> to refund the customer instead).
            </li>
            <li>
              <strong className="text-stone-900">Complete delivery:</strong> under &quot;Out for delivery,&quot;
              click <UI>Mark delivered</UI> once it&apos;s arrived.
            </li>
            <li>
              <strong className="text-stone-900">Manage the menu:</strong> sidebar → Menu. Add/rename/remove/reorder
              categories under &quot;Menu categories.&quot; Click <UI>+ New item</UI> for a new dish — Name,
              Description, Price, and either <UI>Upload photo</UI> (jpg/png/webp/gif, 5MB max) or paste a photo
              URL directly. <UI>Edit</UI> to change any item later (including replacing its photo),{" "}
              <UI>Add-ons</UI> to attach modifier groups (e.g. required spice level, optional extras with their
              own prices), <UI>Hide</UI>/<UI>Show</UI> to toggle customer visibility without deleting,{" "}
              <UI>Remove</UI> to delete outright.
            </li>
            <li>
              <strong className="text-stone-900">Settings:</strong> sidebar → Settings — restaurant photo, name,
              address, delivery radius (miles), delivery fee (£), minimum order (£), plus the customer-facing
              about/description, contact phone, and contact email. <UI>Save settings</UI>.
            </li>
          </ol>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Secondary features</h3>
          <ul className="flex flex-col gap-3">
            <li>
              <strong className="text-stone-900">Drivers</strong> — sidebar → Drivers. Invite someone by email;
              they show &quot;Awaiting response&quot; until they accept from their own driver dashboard, then
              &quot;Active.&quot; <UI>Remove</UI> to revoke.
            </li>
            <li>
              <strong className="text-stone-900">Delivery schedule</strong> — sidebar → Deliveries. Set a
              delivery window (start/end time), capacity per day, a cutoff hour, tick which days of the week you
              deliver, choose how many days ahead to generate, then <UI>Generate schedule</UI> — this creates
              the real bookable slots customers pick from. &quot;Upcoming days&quot; shows booked-vs-capacity
              for each.
            </li>
            <li>
              <strong className="text-stone-900">Payouts</strong> — sidebar → Payouts. Shows Stripe Connect
              onboarding status; once set up, payouts fire automatically after each delivered order&apos;s
              dispute window closes.
            </li>
            <li>
              <strong className="text-stone-900">Reviews</strong> — sidebar → Reviews. Read-only list of what
              customers have said, with your running average.
            </li>
            <li>
              <strong className="text-stone-900">Full order history</strong> — sidebar → Orders. Everything
              beyond the live Dashboard view, filterable by status and delivery date, with a &quot;Prep
              summary&quot; (aggregated item counts across whatever&apos;s currently filtered — genuinely useful
              for kitchen prep) and <UI>Export CSV</UI>.
            </li>
          </ul>
        </section>

        {/* ============================= ADMIN ============================= */}
        <section>
          <p className="text-xs font-semibold tracking-wide text-orange-600 mb-1">ROLE 3 OF 3</p>
          <h2 className="text-xl font-bold text-stone-900 mb-1">Admin</h2>
          <p className="text-sm text-stone-500 mb-6">
            Platform oversight: approvals, disputes, promotions, and broadcasts.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-800 font-medium mb-1">Read this before anything else</p>
            <p className="text-sm text-red-700 mb-2">
              <strong>There is no self-serve way to become an admin, anywhere in the app — deliberately.</strong>{" "}
              Signing up only ever offers Customer or Restaurant Owner; that restriction is enforced at the form
              level, not just hidden. Promoting a real account to Admin is a manual database change only the
              developer can make.
            </p>
            <p className="text-sm text-red-700">
              Practically: testers cannot get admin access on their own. If the steps below need testing, that
              has to happen either directly by the developer, or by the developer promoting one specific
              trusted tester&apos;s account and sharing that login privately — never inside a guide handed to
              external testers, since an admin account can approve or reject any restaurant, resolve any
              dispute, and email every single user on the platform.
            </p>
          </div>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Core workflow (whoever holds admin access)</h3>
          <ol className="list-decimal pl-5 flex flex-col gap-2 mb-6">
            <li>
              <strong className="text-stone-900">Overview</strong> (/admin) — platform stats at a glance: orders
              today/this week/this month, commission revenue, signup fee revenue, top restaurants by order
              volume. Banners for pending restaurant approvals or open disputes appear at the top automatically
              whenever there are any.
            </li>
            <li>
              <strong className="text-stone-900">Approve or reject a restaurant</strong> — sidebar → Restaurants,
              filter Pending/Approved/Rejected/All. Each card shows the owner&apos;s name/email, menu item
              count, delivery slots set up, and signup-fee-paid status. Click <UI>Approve</UI>, or{" "}
              <UI>Reject</UI> with a reason (shown to the owner).
            </li>
            <li>
              <strong className="text-stone-900">Resolve a dispute</strong> — sidebar → Disputes, Open / All
              (incl. resolved). Each shows the customer&apos;s complaint against the order detail.{" "}
              <UI>Side with restaurant — release payout</UI> or <UI>Side with customer — refund</UI>, with an
              optional internal note.
            </li>
          </ol>

          <h3 className="text-base font-semibold text-stone-900 mb-2">Secondary features</h3>
          <ul className="flex flex-col gap-3 mb-6">
            <li>
              <strong className="text-stone-900">Promotions</strong> — sidebar → Promotions.{" "}
              <UI>+ New promo code</UI>: percentage or fixed-£ off, optional minimum order, optional maximum
              total redemptions. <UI>Activate</UI>/<UI>Deactivate</UI> any existing code.
            </li>
            <li>
              <strong className="text-stone-900">Broadcast</strong> — sidebar → Broadcast. One-off email to
              every Customer, every Restaurant owner, or Everyone. Sends immediately on confirmation and
              can&apos;t be undone — there&apos;s a confirm dialog for exactly this reason.
            </li>
            <li>
              <strong className="text-stone-900">Feature flags</strong> — sidebar → Feature flags. Create a flag
              by key (e.g. subscriptions), then Enable/Disable it. A feature with no flag row here defaults to
              enabled.
            </li>
          </ul>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium mb-1">Careful with these two</p>
            <p className="text-sm text-amber-700">
              <UI>Broadcast</UI> emails real inboxes the instant you confirm it, and approving/rejecting a
              restaurant affects a real applicant. Neither was actually triggered while writing this guide, for
              exactly that reason — both were confirmed accurate by reading the page and its code, not by firing
              them for real.
            </p>
          </div>
        </section>

        {/* ============================= REPORTING ============================= */}
        <section className="border-t-2 border-stone-900 pt-8">
          <h2 className="text-xl font-bold text-stone-900 mb-2">Reporting back</h2>
          <p className="text-sm text-stone-600 mb-4">
            For every step: just what you expected to happen, and what actually happened. That&apos;s the whole
            format — you don&apos;t need to guess why something broke, just where it broke.
          </p>
          <div className="border border-stone-200 rounded-xl p-4 flex flex-col gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium">Step</p>
              <p className="text-sm text-stone-700">Restaurant Owner → Core workflow → step 5, clicking &quot;Upload photo&quot;</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium">Expected</p>
              <p className="text-sm text-stone-700">A file picker opens, then the photo shows in the item row after upload.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium">Actual</p>
              <p className="text-sm text-stone-700">File picker opened fine, but the photo never appeared — item still shows the placeholder icon.</p>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-6">
            Verified live against premeal.onrender.com. If anything above stops matching what you see, that&apos;s
            worth reporting too.
          </p>
        </section>
      </div>
    </main>
  );
}
