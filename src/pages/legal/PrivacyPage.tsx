// /privacy. Every statement here matches the code and the database as of the effective date: the tables in
// supabase/migrations/deca_0002 to deca_0009, the analytics allowlist and 13-month purge (deca_0005), the owner
// privacy rules (deca_0006, deca_0007), deca_delete_my_data, and the browser storage in src/lib. Change the page when
// any of those change. Not reviewed by a lawyer, and it says so.
import { Link } from "react-router-dom";
import { Bullets, Defs, LegalDoc, Mail, type LegalSection } from "./LegalDoc";

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          DECA Masters is a free practice site for DECA competitors, made by two
          high school students in Ontario, Canada. It is an independent project.
          It is not run by, affiliated with, or endorsed by DECA Inc. or DECA
          Ontario, and nothing you do here is shared with them.
        </p>
        <p>
          Questions about your information go to <Mail />. That address reaches
          the people who run the site.
        </p>
      </>
    ),
  },
  {
    id: "shared-account",
    title: "One login for two sites",
    body: (
      <>
        <p>
          Your login (email and password) lives in an account system we share
          with our FBLA practice site, which the same people run. Signing up on
          either site gives you a login that works on both.
        </p>
        <p>
          Each site keeps its own study data in its own tables. The DECA site
          does not read your FBLA activity, and the FBLA site does not read your
          DECA activity. Deleting your DECA data leaves your FBLA data and the
          shared login in place unless you ask us to delete those too.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>
          Only what the site needs to work, and nothing to sell or advertise
          with.
        </p>
        <Defs
          items={[
            [
              "Your login",
              "Your email address and password. The password is stored scrambled (hashed) by our database provider, and we never see it.",
            ],
            [
              "Your profile",
              "A username, a display name, and, if you add them, your school, your grade (7 to 12) and up to six DECA events. Whether your profile is public, and your practice rating and streaks.",
            ],
            [
              "Your practice",
              "Each practice run and exam you take: the questions, the choices you picked, whether they were right, and how long you took. Vocab cards you review and when they are due again.",
            ],
            [
              "Your role-play practice",
              "Sessions you save in the trainer: the event, which official sample you practised, your prep and presentation times, your own ratings, and any notes you write (up to 4,000 characters).",
            ],
            [
              "Bookmarks and goals",
              "Items you bookmark with an optional short note, and study goals you set.",
            ],
            [
              "Feedback you send",
              "Your message, what kind of report it is, the page you sent it from, and the question or term it is about. Please leave personal details out of it.",
            ],
            [
              "Usage events",
              "A short, fixed list of moments such as finishing onboarding, starting or finishing practice, opening a linked resource, or installing the app, with an event or exam code and a few fixed labels. Never question text, your answers, anything you type, your IP address, your device or your location. Only for signed-in members. Deleted automatically after 13 months.",
            ],
            [
              "Technical logs",
              "Our hosting and database providers keep standard server and sign-in logs, which include IP addresses, to keep the service running and secure. We do not use them to track you.",
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: "device",
    title: "What stays on your device",
    body: (
      <>
        <p>
          Your browser stores the token that keeps you signed in and a few
          display choices, such as light or dark theme. We use no advertising or
          tracking cookies and no third-party analytics, and our fonts are
          served from our own site, so loading a page does not tell another
          company you visited.
        </p>
        <p>
          If you install the site as an app, it keeps a copy of the app&apos;s
          own files so it can open without a connection. It does not keep a copy
          of your data.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <Bullets>
        <li>
          To run the site: sign you in, save your progress, and show your stats.
        </li>
        <li>To rank the leaderboard, only if you make your profile public.</li>
        <li>
          To answer and fix what you report, and to reply in &ldquo;Your
          reports&rdquo;.
        </li>
        <li>
          To see, in totals, which tools get used and where students get stuck,
          so we know what to improve.
        </li>
      </Bullets>
    ),
  },
  {
    id: "who-sees",
    title: "Who can see what",
    body: (
      <Defs
        items={[
          ["You", "Everything tied to your account."],
          [
            "Other members",
            "Nothing, unless you make your profile public. Then signed-in members can see your username, display name, main event, rating and number of questions answered on the leaderboard. Profiles start private. Visitors who are not signed in see none of it.",
          ],
          [
            "The people who run the site",
            <>
              Totals, with any group of fewer than five people hidden. Feedback
              you send, with your username. They can hide a member from the
              leaderboard, and they can look up a member&apos;s email address
              only to answer a support request. Each of those actions needs a
              written reason and is recorded in a log that cannot be edited.
            </>,
          ],
          [
            "Service providers",
            "Supabase (accounts and database) and Vercel (hosting) store and process data for us under their own security and privacy terms. Their servers may be outside Canada, so your information may be stored in another country and be subject to its laws.",
          ],
          [
            "Nobody else",
            "We do not sell or rent your information, show ads, or share it with DECA Inc., your school, or anyone else, unless the law requires it.",
          ],
        ]}
      />
    ),
  },
  {
    id: "students",
    title: "Students and parents",
    body: (
      <>
        <p>
          DECA Masters is made for students in grades 7 to 12, most of whom are
          under 18. That is why we collect so little, keep profiles private
          until you choose otherwise, and never ask for your birthday, address
          or phone number.
        </p>
        <p>
          If you are under 13, ask a parent or guardian before you make an
          account. A parent or guardian can email <Mail /> to see what is stored
          about their child or to have it deleted.
        </p>
      </>
    ),
  },
  {
    id: "principles",
    title: "Canadian privacy law",
    body: (
      <>
        <p>
          We follow the ten fair information principles in Canada&apos;s
          Personal Information Protection and Electronic Documents Act (PIPEDA): we are accountable for your information, tell you why we
          collect it, ask for your consent, collect only what we need, use and
          keep it only for those reasons, keep it accurate and safe, are open
          about what we do, let you see and correct it, and let you challenge
          how we handle it.
        </p>
        <p>
          If you think we got something wrong, tell us first at <Mail />. You
          can also contact the{" "}
          <a href="https://www.priv.gc.ca/en/" rel="noreferrer">
            Office of the Privacy Commissioner of Canada
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <Defs
        items={[
          [
            "See or correct it",
            "Your profile, stats and history are shown to you on the site. Email us for a copy of anything else we hold about you.",
          ],
          [
            "Stay off the leaderboard",
            "Keep your profile private (the default), or switch it back to private at any time.",
          ],
          [
            "Delete your DECA data",
            <>
              Email <Mail /> from the address on your account. We delete your
              profile, practice history, vocab progress, role-play sessions,
              bookmarks, goals, feedback and usage events, and email you when it
              is done.
            </>,
          ],
          [
            "Delete your whole account",
            "Say so in the same email and we also delete the shared login. That ends your access to the FBLA site too, so we will check with you first.",
          ],
        ]}
      />
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <Bullets>
        <li>
          Your account, profile and study data: until you ask us to delete them.
        </li>
        <li>Usage events: 13 months, then they are deleted automatically.</li>
        <li>Feedback: until you delete your DECA data.</li>
        <li>
          The log of actions taken by the people who run the site is kept as a
          security record. It names accounts by an internal number, and stays
          after an account is deleted.
        </li>
      </Bullets>
    ),
  },
  {
    id: "security",
    title: "Keeping it safe",
    body: (
      <p>
        Every connection to the site is encrypted. The database only lets each
        member read their own records, and the tools for the people who run the
        site are checked on the server, not just hidden in the page. No system
        is perfect: if a problem ever puts your information at real risk, we
        will tell you and explain what we are doing about it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        When we change this policy, we update the effective date at the top. If
        a change affects how we use information you already gave us, we will say
        so on the site before it takes effect.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      lede="What DECA Masters collects, why, who can see it, and how to delete it. Written in plain language for students."
      summary={[
        "We collect what the site needs: your login, your profile, your practice, and the feedback you send.",
        "Your login is shared with our FBLA practice site. Your study data on each site stays separate.",
        "Profiles are private until you make them public. We never sell your information or show ads.",
        <>
          Email <Mail /> to delete your DECA data or your whole account.
        </>,
        <>
          This policy has not been reviewed by a lawyer. DECA Masters is not
          affiliated with or endorsed by DECA Inc. See the{" "}
          <Link to="/terms">Terms of Use</Link>.
        </>,
      ]}
      sections={sections}
      sibling={{ to: "/terms", label: "Terms of Use" }}
    />
  );
}
